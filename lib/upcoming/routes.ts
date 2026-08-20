/**
 * What is coming, for the titles this account has saved.
 *
 * The cheap half of a feature that looks expensive. The hourly sweep already
 * refreshes `watched_media.next_air_date` for every title any supporter has
 * watchlisted — it has to, to know when to send an alert — so the answer to
 * "what is out next week" is already sitting in the database. Everything here is
 * one JOIN over rows that exist for another reason: **zero TMDB subrequests**,
 * which is the only reason it can be offered at all on the free plan.
 *
 * Two ways in. `/api/upcoming` is the account panel, authenticated by session
 * cookie. `/api/calendar/<token>.ics` is a real subscribable calendar feed, and
 * is authenticated by the token in the URL and nothing else — a calendar client
 * has no cookies, no session, and no way to be handed one.
 */

import { loadSession, sessionCookieOf, USER_COLUMNS } from '@/lib/auth/session'
import { isEntitled, type BillingRow } from '@/lib/billing/entitlement'

import { buildIcs, type UpcomingItem } from './ics'
import { buildRss } from './rss'

/** A season's worth of dates. Beyond that TMDB rarely knows, and nobody plans. */
const HORIZON_DAYS = 180
/** Far above any watchlist that has this many titles dated at once. */
const MAX_ROWS = 100
/** How far back the subscribable feed reaches. See handleCalendarFeed. */
const FEED_BACKFILL_DAYS = 7

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

const dayOf = (stamp: number): string =>
  new Date(stamp).toISOString().slice(0, 10)

/**
 * The one query behind both entry points.
 *
 * Dates are compared as STRINGS against today in UTC, the same way the sweep
 * decides an episode has aired. TMDB air dates have no time and no zone, so a
 * `Date` subtraction would move an episode a day in either direction depending
 * on which colo answered.
 */
async function loadUpcoming(
  db: D1Database,
  userId: string,
  now: number,
  backDays = 0
): Promise<UpcomingItem[]> {
  const rows = await db
    .prepare(
      `SELECT watched_media.media_key AS key,
              watched_media.name AS name,
              watched_media.next_air_date AS date,
              watched_media.next_label AS label
       FROM sync_items
       JOIN watched_media ON watched_media.media_key = sync_items.item_key
       WHERE sync_items.user_id = ?
         AND sync_items.store = 'watchlist'
         AND sync_items.payload IS NOT NULL
         AND watched_media.next_air_date IS NOT NULL
         AND watched_media.next_air_date >= ?
         AND watched_media.next_air_date <= ?
       ORDER BY watched_media.next_air_date ASC
       LIMIT ${MAX_ROWS}`
    )
    .bind(
      userId,
      dayOf(now - backDays * 86400000),
      dayOf(now + HORIZON_DAYS * 86400000)
    )
    .all<{
      key: string
      name: string | null
      date: string
      label: string | null
    }>()

  return (rows.results ?? []).map((row) => ({
    key: row.key,
    // The sweep fills `name` on its first check. A title watchlisted minutes ago
    // can legitimately be dated but unnamed for one tick.
    name: row.name ?? 'A title you saved',
    date: row.date,
    label: row.label,
  }))
}

/** 128 bits of hex. Unguessable, and short enough to read out loud if it must be. */
const mintToken = (): string => crypto.randomUUID().replace(/-/g, '')

/**
 * The account's feed secret, minted on first ask.
 *
 * Lazily rather than at sign-up, so an account that never opens this section
 * never has a live URL to leak. `rotate` writes a new one, which is what makes
 * the button next to it mean something: the old URL stops working immediately.
 */
async function feedToken(
  db: D1Database,
  userId: string,
  rotate: boolean
): Promise<string> {
  if (!rotate) {
    const row = await db
      .prepare('SELECT calendar_token FROM users WHERE id = ?')
      .bind(userId)
      .first<{ calendar_token: string | null }>()
    if (row?.calendar_token) return row.calendar_token
  }

  const token = mintToken()
  await db
    .prepare('UPDATE users SET calendar_token = ? WHERE id = ?')
    .bind(token, userId)
    .run()
  return token
}

/**
 * GET /api/upcoming — dated rows plus this account's feed URL.
 * POST /api/upcoming — the same, with a freshly rotated feed URL.
 */
export async function handleUpcoming(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)

  // 402, like sync and alerts: the client can tell "support unlocks this" apart
  // from "you are not allowed" and show the right panel rather than an error.
  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'The schedule is a supporter feature.' },
      402
    )
  }

  const [items, token, watchlist] = await Promise.all([
    loadUpcoming(db, user.id, now),
    feedToken(db, user.id, request.method === 'POST'),
    watchlistSize(db, user.id),
  ])

  return json({
    success: true,
    items,
    // How many titles this account has SYNCED, which is what tells an empty
    // schedule apart from an empty watchlist. Without it the panel says "nothing
    // dated yet" to somebody whose watchlist is empty, which reads as Reely not
    // having got round to it — and leaves them waiting for something that is
    // never going to arrive. Measured on a real account: the schedule was empty
    // because nothing had ever been saved, and the copy gave no way to tell.
    watchlist,
    feedPath: `/api/calendar/${token}.ics`,
    // The same rows, for a feed reader instead of a calendar. Same token and
    // the same prefix on purpose: the WAF exemptions that keep a machine
    // poller from being challenged are written against /api/calendar/, and a
    // second prefix would be a second rule to forget.
    rssPath: `/api/calendar/${token}.xml`,
  })
}

/** How many live (non-tombstone) titles this account has in its synced watchlist. */
async function watchlistSize(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM sync_items
       WHERE user_id = ? AND store = 'watchlist' AND payload IS NOT NULL`
    )
    .bind(userId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

const feed = (body: string, contentType: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      // Behind an unguessable token and specific to one person, so it must never
      // land in a shared cache. Pollers come back on their own schedule — hours
      // apart — and honour nothing finer than this anyway.
      'Cache-Control': 'private, no-store',
    },
  })

const calendar = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="reely.ics"',
      // Behind an unguessable token and specific to one person, so it must never
      // land in a shared cache. Calendar clients poll on their own schedule —
      // hours apart — and honour nothing finer than this anyway.
      'Cache-Control': 'private, no-store',
    },
  })

/**
 * GET /api/calendar/<token>.ics — the subscribable calendar.
 * GET /api/calendar/<token>.xml — the same schedule, as RSS.
 *
 * The one authenticated endpoint here with no session behind it. Three
 * consequences, all deliberate:
 *
 *  - The token is checked against a UNIQUE index, so a wrong one is one indexed
 *    lookup and a 404, not a scan.
 *  - Entitlement is re-checked on every poll rather than trusted from when the
 *    URL was minted: support that lapses must stop feeding a calendar that would
 *    otherwise keep refreshing forever.
 *  - A refusal is an EMPTY VALID CALENDAR, not an error status. A calendar
 *    client that gets a 401 shows the user a broken-subscription warning it will
 *    never clear on its own; an empty calendar is the honest, quiet state, and
 *    it starts filling again the moment support resumes.
 */
export async function handleCalendarFeed(
  pathname: string,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const tail = pathname.slice('/api/calendar/'.length).trim()
  const rss = /\.xml$/i.test(tail)
  const token = tail.replace(/\.(ics|xml)$/i, '')

  // A refusal has to be a valid, empty document of the format that was asked
  // for. Both a calendar client and a feed reader treat an error status as a
  // broken subscription and warn about it until a human intervenes; an empty
  // document is the quiet, honest state, and it fills again on its own the
  // moment there is something to say.
  const empty = (status = 200) =>
    rss
      ? feed(
          buildRss([], feedOrigin(), now, pathname),
          'application/rss+xml; charset=utf-8',
          status
        )
      : calendar(buildIcs([], feedOrigin(), now), status)

  // Shape-checked before it reaches the database: this path is public, so the
  // cheapest possible rejection of a scan is worth having.
  if (!/^[0-9a-f]{32}$/.test(token)) return empty(404)

  const user = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE calendar_token = ?`)
    .bind(token)
    .first<BillingRow & { id: string }>()

  if (!user || !isEntitled(user, now)) return empty()

  // The feed reaches a week back; the panel does not. A calendar that opens on
  // an empty month looks broken, and "this aired on Tuesday and you missed it"
  // is exactly what somebody wants from a calendar. The panel is a schedule of
  // what is coming, so the past has no business in it.
  const items = await loadUpcoming(db, user.id, now, FEED_BACKFILL_DAYS)
  return rss
    ? feed(
        buildRss(items, feedOrigin(), now, pathname),
        'application/rss+xml; charset=utf-8'
      )
    : calendar(buildIcs(items, feedOrigin(), now))
}

/**
 * Where the links in the feed point.
 *
 * Fixed rather than read from the request Host: a calendar entry outlives the
 * request that created it by months, and a link built from whatever host a
 * client happened to poll (a preview deployment, the apex before its redirect)
 * would still be in someone's calendar long after that host stopped answering.
 */
function feedOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  return (configured || 'https://www.reely.space').replace(/\/$/, '')
}
