/**
 * The hourly sweep: what aired, and who wanted to know.
 *
 * Runs on a Cron Trigger, so nothing here is on any visitor's request path and
 * none of it counts against the request budget a page view competes for. It is
 * still deliberately bounded, because a cron invocation gets the same 50
 * subrequests and the same CPU ceiling as any other.
 *
 * The shape is "re-check, do not re-discover": watchlists name the titles worth
 * watching, `watched_media` remembers what was last seen for each, and each tick
 * refreshes the least recently checked handful. A title someone added an hour
 * ago is checked within a few ticks; a title nobody watches is never fetched at
 * all.
 */

import { fetchClient } from '@/lib/fetch-client'
import {
  mergeAnnounced,
  newProviders,
  parseProviderMap,
  providerAnnouncement,
  providerMap,
  type ProviderMap,
  type TmdbWatchProviders,
} from '@/lib/push/providers'

import { normaliseQuietHours, shouldRing } from './quiet'
import { sendPush } from './vapid'

/**
 * How many titles one tick refreshes.
 *
 * The hard ceiling is the 50-subrequest cap, which this shares with the push
 * sends below. Twenty-five leaves room for the sends and still cycles 600 titles
 * a day — far more than a hobby-scale watchlist set.
 */
const CHECK_PER_TICK = 25

/** How many new titles one tick may adopt into `watched_media`. */
const DISCOVER_PER_TICK = 200

/** Sends per tick, so one popular finale cannot exhaust the subrequest budget. */
const MAX_SENDS = 20

interface TmdbEpisode {
  air_date?: string | null
  season_number?: number | null
  episode_number?: number | null
  name?: string | null
}

interface TmdbSeries {
  name?: string
  /** From append_to_response, so it costs no extra subrequest. */
  'watch/providers'?: TmdbWatchProviders | null
  /** Minutes per episode. An array because anthologies vary; the first is typical. */
  episode_run_time?: number[] | null
  next_episode_to_air?: TmdbEpisode | null
  last_episode_to_air?: TmdbEpisode | null
}

interface TmdbMovie {
  title?: string
  'watch/providers'?: TmdbWatchProviders | null
  runtime?: number | null
  release_date?: string | null
}

export interface MediaState {
  name: string | null
  nextAirDate: string | null
  nextLabel: string | null
  /**
   * Minutes for one sitting — a film, or one episode of a series. Null when
   * TMDB does not say, which it often does not for unreleased titles.
   *
   * Nothing reads this yet. It is stored because the sweep already holds the
   * response it comes from, and collecting it from today means the history is
   * there whenever hours-watched is worth answering; asking for it later would
   * mean one TMDB request per title in somebody's library.
   */
  runtime: number | null
  /** Which subscription services carry it, per region. See providers.ts. */
  providers: ProviderMap
  /** Non-null when something has just become available. */
  announce: { key: string; title: string; body: string; url: string } | null
}

/** Minutes for one episode, or null if TMDB has not said. */
const episodeRuntime = (series: TmdbSeries): number | null => {
  const first = series.episode_run_time?.[0]
  return typeof first === 'number' && first > 0 ? first : null
}

const episodeKey = (episode: TmdbEpisode): string =>
  `${episode.season_number ?? 0}:${episode.episode_number ?? 0}`

const pad = (value: number) => String(value).padStart(2, '0')

const episodeLabel = (episode: TmdbEpisode): string =>
  `S${pad(Number(episode.season_number ?? 0))}E${pad(Number(episode.episode_number ?? 0))}`

/**
 * Whether a date string has arrived, compared as DATES.
 *
 * TMDB air dates carry no time and no timezone, so this is a string comparison
 * against today in UTC rather than a `Date` subtraction — which would otherwise
 * announce an episode a few hours early or late depending on where the isolate
 * happened to run.
 */
export function hasAired(
  airDate: string | null | undefined,
  now: number
): boolean {
  if (!airDate) return false
  return airDate <= new Date(now).toISOString().slice(0, 10)
}

/**
 * Decide what one series is worth saying, given what we last said about it.
 *
 * Pure, so the announce/do-not-announce rule is testable without TMDB: the whole
 * point is that an episode is announced exactly once, and that a series that has
 * simply not aired anything is silent rather than repeatedly interesting.
 */
export function seriesState(
  series: TmdbSeries,
  notifiedKey: string | null,
  seriesId: string,
  now: number
): MediaState {
  const next = series.next_episode_to_air ?? null
  const last = series.last_episode_to_air ?? null
  const name = series.name ?? null

  const state: MediaState = {
    name,
    nextAirDate: next?.air_date ?? null,
    nextLabel: next ? episodeLabel(next) : null,
    runtime: episodeRuntime(series),
    providers: providerMap(series['watch/providers'] ?? null),
    announce: null,
  }

  if (!last || !hasAired(last.air_date, now)) return state

  const key = episodeKey(last)
  if (key === notifiedKey) return state

  state.announce = {
    key,
    title: `${name ?? 'A show you follow'} — ${episodeLabel(last)}`,
    body: last.name ? `${last.name} is out now.` : 'A new episode is out now.',
    url: `/tv-shows/${seriesId}`,
  }
  return state
}

/** The film twin: one announcement, on the day it is out. */
export function movieState(
  movie: TmdbMovie,
  notifiedKey: string | null,
  movieId: string,
  now: number
): MediaState {
  const name = movie.title ?? null
  const state: MediaState = {
    name,
    nextAirDate: movie.release_date ?? null,
    nextLabel: null,
    runtime:
      typeof movie.runtime === 'number' && movie.runtime > 0
        ? movie.runtime
        : null,
    providers: providerMap(movie['watch/providers'] ?? null),
    announce: null,
  }

  if (notifiedKey === 'release') return state
  if (!hasAired(movie.release_date, now)) return state

  state.announce = {
    key: 'release',
    title: `${name ?? 'A film you saved'} is out`,
    body: 'It has reached its release date.',
    url: `/movies/${movieId}`,
  }
  return state
}

/**
 * Adopt anything newly watchlisted, then re-check the oldest handful.
 *
 * The discovery query scans the watchlist store, which is the one unbounded read
 * in this file. It is bounded by LIMIT and it runs on a cron rather than on a
 * request, which is the trade: D1 bills rows scanned, and this is the cheapest
 * place in the system to spend them.
 */
async function refreshCandidates(db: D1Database, now: number): Promise<void> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT item_key FROM sync_items
       WHERE store = 'watchlist' AND payload IS NOT NULL
       LIMIT ${DISCOVER_PER_TICK}`
    )
    .all<{ item_key: string }>()

  const keys = (rows.results ?? []).map((row) => row.item_key)
  if (keys.length === 0) return

  // checked_at = 0 so a newly adopted title sorts to the front of the next
  // check, rather than waiting a full cycle behind titles already known.
  const statement = db.prepare(
    `INSERT INTO watched_media (media_key, checked_at) VALUES (?, 0)
     ON CONFLICT(media_key) DO NOTHING`
  )
  await db.batch(keys.map((key) => statement.bind(key)))
  void now
}

/** Where a media_key points on the site. */
const mediaHref = (mediaKey: string): string => {
  const [kind, id] = mediaKey.split(':')
  return kind === 'series' ? `/tv-shows/${id}` : `/movies/${id}`
}

/** The region a user chose for "now streaming", or null if they never did. */
const regionOf = (prefs: string | null): string | null => {
  if (!prefs) return null
  try {
    const parsed = JSON.parse(prefs)
    const region = parsed?.region
    return typeof region === 'string' && region ? region : null
  } catch {
    return null
  }
}

/**
 * Who asked to hear about this title, and can still be told.
 *
 * Returns the region alongside the id because the streaming announcement is
 * per-region: a title landing on a service in Germany is not news in Brazil,
 * and telling everybody about every region is how a quiet feature becomes the
 * reason people switch alerts off. `prefs` is parsed here rather than matched
 * in SQL for the same reason `grants` is not - a LIKE against JSON is fine as
 * a cheap prefilter, but the value itself has to be read properly.
 */
async function interestedUsers(
  db: D1Database,
  mediaKey: string
): Promise<{ userId: string; region: string | null }[]> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT sync_items.user_id AS user_id, users.prefs AS prefs
       FROM sync_items
       JOIN users ON users.id = sync_items.user_id
       WHERE sync_items.store = 'watchlist'
         AND sync_items.item_key = ?
         AND sync_items.payload IS NOT NULL
         AND users.grants LIKE '%pro%'
         AND COALESCE(users.prefs, '') LIKE '%"alerts":true%'`
    )
    .bind(mediaKey)
    .all<{ user_id: string; prefs: string | null }>()
  return (rows.results ?? []).map((row) => ({
    userId: row.user_id,
    region: regionOf(row.prefs),
  }))
}

/**
 * The whole tick. Exported for the Worker's `scheduled` handler and for a manual
 * run against a preview deployment, which is the only way to prove a sweep works
 * before an episode actually airs.
 */
export async function runSweep(
  db: D1Database,
  now: number
): Promise<{ checked: number; announced: number; pushed: number }> {
  await refreshCandidates(db, now)

  const due = await db
    .prepare(
      `SELECT media_key, notified_key, providers_notified FROM watched_media
       ORDER BY checked_at ASC LIMIT ${CHECK_PER_TICK}`
    )
    .all<{
      media_key: string
      notified_key: string | null
      providers_notified: string | null
    }>()

  let announced = 0
  let pushed = 0
  const queued: {
    userId: string
    announce: NonNullable<MediaState['announce']>
  }[] = []

  for (const row of due.results ?? []) {
    const [kind, id] = row.media_key.split(':')
    if (!id || !/^\d+$/.test(id)) continue

    let state: MediaState
    try {
      if (kind === 'series') {
        const series = await fetchClient.get<TmdbSeries>(
          // append_to_response, so "now streaming" costs zero extra
          // subrequests. See lib/push/providers.ts and the
          // 50-per-invocation cap that shapes this whole file.
          `tv/${id}?language=en-US&append_to_response=watch/providers`,
          {},
          true,
          // Six hours: the sweep runs hourly, and an air date does not move
          // often enough to be worth a fresh TMDB call every time.
          6 * 60 * 60
        )
        state = seriesState(series, row.notified_key, id, now)
      } else {
        const movie = await fetchClient.get<TmdbMovie>(
          `movie/${id}?language=en-US&append_to_response=watch/providers`,
          {},
          true,
          6 * 60 * 60
        )
        state = movieState(movie, row.notified_key, id, now)
      }
    } catch {
      // A dead id or a TMDB blip. Stamp it checked anyway so it goes to the back
      // of the queue instead of being retried every tick forever.
      await db
        .prepare('UPDATE watched_media SET checked_at = ? WHERE media_key = ?')
        .bind(now, row.media_key)
        .run()
      continue
    }

    // What is newly watchable, per region, measured against what was last
    // announced. A row that has never been announced records its state and
    // stays silent - otherwise shipping this would have fired every
    // watchlist's entire backlog at once. See newProviders().
    const alreadyAnnounced = parseProviderMap(row.providers_notified)
    const fresh = newProviders(state.providers, alreadyAnnounced)
    const nextAnnounced = mergeAnnounced(alreadyAnnounced, state.providers)

    await db
      .prepare(
        `UPDATE watched_media
         SET name = ?, next_air_date = ?, next_label = ?, checked_at = ?,
             -- Keep the last known runtime when TMDB stops reporting one, which
             -- it does for titles that get re-listed as upcoming.
             runtime = COALESCE(?, runtime),
             providers = ?,
             providers_notified = ?,
             notified_key = COALESCE(?, notified_key)
         WHERE media_key = ?`
      )
      .bind(
        state.name,
        state.nextAirDate,
        state.nextLabel,
        now,
        state.runtime,
        JSON.stringify(state.providers),
        JSON.stringify(nextAnnounced),
        state.announce?.key ?? null,
        row.media_key
      )
      .run()

    // Two independent announcements can come out of one title in one tick: it
    // aired AND it landed on a service. They are queued separately because they
    // are different sentences to different people - the release goes to
    // everyone who follows it, the streaming line only to the regions it
    // actually changed in.
    const regions = Object.keys(fresh)
    if (!state.announce && regions.length === 0) continue

    const interested = await interestedUsers(db, row.media_key)
    if (state.announce) {
      announced++
      for (const { userId } of interested) {
        queued.push({ userId, announce: state.announce })
      }
    }
    for (const region of regions) {
      const wording = providerAnnouncement(
        state.name ?? 'A title you saved',
        fresh[region],
        region
      )
      for (const { userId, region: theirs } of interested) {
        if (theirs !== region) continue
        announced++
        queued.push({
          userId,
          announce: {
            key: 'providers',
            title: wording.title,
            body: wording.body,
            url: mediaHref(row.media_key),
          },
        })
      }
    }
  }

  if (queued.length > 0) {
    const insert = db.prepare(
      `INSERT INTO notifications (id, user_id, title, body, url, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    await db.batch(
      queued.map((item) =>
        insert.bind(
          crypto.randomUUID(),
          item.userId,
          item.announce.title,
          item.announce.body,
          item.announce.url,
          now
        )
      )
    )
    // Everybody who has something waiting, minus everybody whose phone should
    // not make a noise about it right now. The rows above are already written,
    // so a silenced account still finds its alerts when it next opens the app —
    // being quiet costs nothing but the buzz.
    const audience = [...new Set(queued.map((item) => item.userId))]
    const ringing = await ringable(db, audience, now)
    if (ringing.length > 0) {
      pushed = await wake(db, ringing, now)
      await db
        .prepare(
          `UPDATE users SET last_push_at = ?
           WHERE id IN (${ringing.map(() => '?').join(', ')})`
        )
        .bind(now, ...ringing)
        .run()
    }
  }

  return { checked: (due.results ?? []).length, announced, pushed }
}

/**
 * Which of these accounts want to be rung at this moment.
 *
 * One query, because the sweep is already the most expensive thing this Worker
 * does and this is a filter, not a feature of its own. `prefs` is parsed here
 * rather than matched in SQL for the same reason it is in interestedUsers: a
 * LIKE against JSON is a prefilter, never a read.
 */
async function ringable(
  db: D1Database,
  userIds: string[],
  now: number
): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT id, prefs, last_push_at FROM users
       WHERE id IN (${userIds.map(() => '?').join(', ')})`
    )
    .bind(...userIds)
    .all<{ id: string; prefs: string | null; last_push_at: number | null }>()

  const out: string[] = []
  for (const row of rows.results ?? []) {
    let prefs: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(row.prefs ?? '{}')
      if (parsed && typeof parsed === 'object') {
        prefs = parsed as Record<string, unknown>
      }
    } catch {
      // Unreadable preferences mean the defaults, which are to ring.
    }
    const ring = shouldRing(
      {
        quiet: normaliseQuietHours(prefs.quiet),
        digest: prefs.digest === true,
        lastPushAt: row.last_push_at,
      },
      now
    )
    if (ring) out.push(row.id)
  }
  return out
}

/**
 * Ring every device belonging to these accounts.
 *
 * The push carries nothing; the service worker fetches what to show. A
 * subscription that answers 404/410 is struck once and deleted on the second
 * strike — one failure is a push service having a bad minute, two is a browser
 * that is never coming back.
 */
async function wake(
  db: D1Database,
  userIds: string[],
  now: number
): Promise<number> {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:hi@reely.space'
  if (!publicKey || !privateKey) return 0

  const placeholders = userIds.map(() => '?').join(', ')
  const subs = await db
    .prepare(
      `SELECT id, endpoint, failed_at FROM push_subs
       WHERE user_id IN (${placeholders}) LIMIT ${MAX_SENDS}`
    )
    .bind(...userIds)
    .all<{ id: string; endpoint: string; failed_at: number | null }>()

  let sent = 0
  for (const sub of subs.results ?? []) {
    const result = await sendPush(
      sub.endpoint,
      subject,
      publicKey,
      privateKey,
      now
    )
    if (result === 'sent') {
      sent++
      if (sub.failed_at !== null) {
        await db
          .prepare('UPDATE push_subs SET failed_at = NULL WHERE id = ?')
          .bind(sub.id)
          .run()
      }
      continue
    }
    if (result === 'gone' || sub.failed_at !== null) {
      await db.prepare('DELETE FROM push_subs WHERE id = ?').bind(sub.id).run()
      continue
    }
    await db
      .prepare('UPDATE push_subs SET failed_at = ? WHERE id = ?')
      .bind(now, sub.id)
      .run()
  }

  return sent
}
