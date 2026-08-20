/**
 * Public profiles: /u/<handle>.
 *
 * The only page on Reely a stranger lands on because a *person* sent it rather
 * than because a search engine found it. Everything else is either private (the
 * library, the console) or about a title (a detail page, a list); this is about
 * whoever built the library, which is what makes it worth sending.
 *
 * Two decisions, deliberately separate: claiming a handle reserves a name, and
 * publishing turns the page on. Off by default — reserving a name and exposing a
 * library are not the same intention.
 *
 * Everything the page shows is already in D1 for another reason: the synced
 * library, published lists, the reviews store. Nothing is written to make a
 * profile work, so a profile cannot drift out of step with the account it
 * belongs to.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'

const MIN_HANDLE = 3
const MAX_HANDLE = 20
const MAX_BIO = 160
const TOP_RATED_LIMIT = 8
const LIST_LIMIT = 12

/**
 * Names the site needs for itself, or that would read as officialdom.
 *
 * A handle becomes `/u/<handle>`, which collides with no route here — but it is
 * also how somebody is introduced ("reely.space/u/support"), and a stranger
 * cannot tell a claimed `support` from a real one.
 */
const RESERVED = new Set([
  'about',
  'account',
  'admin',
  'api',
  'billing',
  'contact',
  'help',
  'login',
  'me',
  'moderator',
  'movies',
  'new',
  'official',
  'privacy',
  'reely',
  'root',
  'settings',
  'signin',
  'signup',
  'staff',
  'support',
  'system',
  'team',
  'terms',
  'tv',
  'tv-shows',
  'u',
  'user',
  'watchlist',
  'you',
])

/**
 * A handle, or null if the input is not one.
 *
 * Lowercased rather than rejected on case: two handles differing only in case
 * are the same name to everyone except the database, and the UNIQUE index in
 * migration 0005 is what has to make that impossible. Dashes are allowed inside
 * and nowhere else, so a handle can never read as a leading flag or trail off
 * into a URL.
 */
export function normaliseHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const handle = value.trim().toLowerCase()
  if (handle.length < MIN_HANDLE || handle.length > MAX_HANDLE) return null
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle)) return null
  if (handle.includes('--')) return null
  if (RESERVED.has(handle)) return null
  return handle
}

/** The line under the name. Optional, plain text, never markup. */
export function normaliseBio(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const bio = value.replace(/\s+/g, ' ').trim()
  if (!bio) return null
  return bio.slice(0, MAX_BIO)
}

export interface ProfileList {
  slug: string
  name: string
  description: string | null
  count: number
  poster_path: string | null
}

export interface ProfileTitle {
  id: number
  type: 'movie' | 'series'
  title: string
  poster_path: string | null
  rating: number | null
}

export interface PublicProfile {
  handle: string
  name: string | null
  picture: string | null
  bio: string | null
  since: number
  counts: {
    watchlist: number
    finished: number
    episodes: number
    lists: number
    reviews: number
  }
  lists: ProfileList[]
  topRated: ProfileTitle[]
}

interface CountRow {
  store: string
  n: number
}

/**
 * The five numbers on a profile, in one query.
 *
 * A GROUP BY over the sync table rather than five COUNTs: D1 bills rows scanned,
 * the index on (user_id, updated_at) already narrows it to this account, and the
 * whole thing is one round trip inside a 10ms budget. A NULL payload is a
 * tombstone — a deleted item — and is excluded here exactly as everywhere else.
 */
async function libraryCounts(
  db: D1Database,
  userId: string
): Promise<Record<string, number>> {
  const rows = await db
    .prepare(
      `SELECT store, COUNT(*) AS n
       FROM sync_items
       WHERE user_id = ? AND payload IS NOT NULL
       GROUP BY store`
    )
    .bind(userId)
    .all<CountRow>()

  const counts: Record<string, number> = {}
  for (const row of rows.results ?? []) counts[row.store] = row.n
  return counts
}

const mediaType = (payload: Record<string, unknown>): 'movie' | 'series' =>
  payload.media_type === 'tv' || typeof payload.name === 'string'
    ? 'series'
    : 'movie'

const titleOf = (payload: Record<string, unknown>): string => {
  if (typeof payload.title === 'string' && payload.title) return payload.title
  if (typeof payload.name === 'string' && payload.name) return payload.name
  return 'Untitled'
}

const posterOf = (payload: Record<string, unknown>): string | null =>
  typeof payload.poster_path === 'string' ? payload.poster_path : null

/**
 * The titles this person rated highest.
 *
 * Sorted and limited by SQLite through `json_extract`, not in JavaScript: the
 * reviews store can hold thousands of rows and the Worker must parse eight of
 * them, not all of them. The one place a profile reads a payload at all.
 */
async function topRated(
  db: D1Database,
  userId: string
): Promise<ProfileTitle[]> {
  const rows = await db
    .prepare(
      `SELECT item_key, payload
       FROM sync_items
       WHERE user_id = ? AND store = 'reviews' AND payload IS NOT NULL
         AND json_extract(payload, '$.rating') IS NOT NULL
       ORDER BY json_extract(payload, '$.rating') DESC, updated_at DESC
       LIMIT ${TOP_RATED_LIMIT}`
    )
    .bind(userId)
    .all<{ item_key: string; payload: string }>()

  const titles: ProfileTitle[] = []
  for (const row of rows.results ?? []) {
    const payload = safeObject(row.payload)
    if (!payload) continue
    const id = Number(payload.id ?? row.item_key)
    if (!Number.isInteger(id)) continue
    const rating = Number(payload.rating)
    titles.push({
      id,
      type: mediaType(payload),
      title: titleOf(payload),
      poster_path: posterOf(payload),
      rating: Number.isFinite(rating) ? rating : null,
    })
  }
  return titles
}

interface ProfileRow {
  id: string
  handle: string
  name: string | null
  picture: string | null
  profile_bio: string | null
  created_at: number
  grants: string | null
  sub_status: string | null
  sub_ends_at: number | null
  sub_past_due_since: number | null
}

const safeObject = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

interface StoredListItem {
  poster_path?: string | null
}

const safeItems = (raw: string): StoredListItem[] => {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredListItem[]) : []
  } catch {
    return []
  }
}

/**
 * Everything /u/<handle> renders, or null if there is nothing to show.
 *
 * "Nothing to show" covers an unclaimed handle, a private profile and an account
 * whose support lapsed — all three answer the same 404, because separating them
 * would tell a stranger which handles exist.
 */
export async function loadPublicProfile(
  db: D1Database,
  rawHandle: string,
  now: number
): Promise<PublicProfile | null> {
  const handle = normaliseHandle(rawHandle)
  if (!handle) return null

  const row = await db
    .prepare(
      `SELECT id, handle, name, picture, profile_bio, created_at, grants,
              sub_status, sub_ends_at, sub_past_due_since
       FROM users WHERE handle = ? AND profile_public = 1`
    )
    .bind(handle)
    .first<ProfileRow>()
  if (!row) return null
  if (!isEntitled(row, now)) return null

  const [counts, lists, rated] = await Promise.all([
    libraryCounts(db, row.id),
    db
      .prepare(
        `SELECT slug, name, description, items
         FROM lists
         WHERE user_id = ? AND published = 1 AND slug IS NOT NULL
         ORDER BY updated_at DESC LIMIT ${LIST_LIMIT}`
      )
      .bind(row.id)
      .all<{
        slug: string
        name: string
        description: string | null
        items: string
      }>(),
    topRated(db, row.id),
  ])

  const published = lists.results ?? []

  return {
    handle: row.handle,
    name: row.name,
    picture: row.picture,
    bio: normaliseBio(row.profile_bio),
    since: row.created_at,
    counts: {
      watchlist: counts.watchlist ?? 0,
      finished: counts.history ?? 0,
      episodes: counts.completed ?? 0,
      lists: published.length,
      reviews: counts.reviews ?? 0,
    },
    lists: published.map((list) => {
      const items = safeItems(list.items)
      return {
        slug: list.slug,
        name: list.name,
        description: list.description,
        count: items.length,
        poster_path: items[0]?.poster_path ?? null,
      }
    }),
    topRated: rated,
  }
}

const publicJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Short, because unpublishing has to take effect quickly and a published
      // profile is not sensitive. Long enough that a link doing the rounds in a
      // group chat is answered from cache.
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })

const privateJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

/** GET /api/profile/<handle> — what the shell fetches to draw the page. */
export async function handlePublicProfile(
  handle: string,
  db: D1Database,
  now: number
): Promise<Response> {
  const profile = await loadPublicProfile(db, handle, now)
  if (!profile) return publicJson({ success: false, error: 'Not found' }, 404)
  return publicJson({ success: true, profile })
}

interface SettingsRow {
  handle: string | null
  profile_public: number
  profile_bio: string | null
}

const settingsOf = (row: SettingsRow | null) => ({
  success: true,
  handle: row?.handle ?? null,
  published: row?.profile_public === 1,
  bio: normaliseBio(row?.profile_bio),
})

const SETTINGS_SQL =
  'SELECT handle, profile_public, profile_bio FROM users WHERE id = ?'

/**
 * GET /api/profile — this account's own profile settings.
 * POST /api/profile — claim a handle, write a bio, publish or unpublish.
 *
 * The handle is claimed once. Changing it later would hand a URL somebody has
 * already shared to a different person, which is the one thing a public
 * identifier must never do.
 */
export async function handleProfileSettings(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return privateJson({ success: false, error: 'Not signed in' }, 401)
  if (!isEntitled(user, now)) {
    return privateJson(
      { success: false, error: 'Profiles are a supporter feature.' },
      402
    )
  }

  const current = await db
    .prepare(SETTINGS_SQL)
    .bind(user.id)
    .first<SettingsRow>()

  if (request.method === 'GET') return privateJson(settingsOf(current))

  const body = safeObject(await request.text())
  if (!body) return privateJson({ success: false, error: 'Bad request' }, 400)

  let handle = current?.handle ?? null

  if (!handle && body.handle !== undefined) {
    const wanted = normaliseHandle(body.handle)
    if (!wanted) {
      return privateJson(
        {
          success: false,
          error:
            'Three to twenty characters: letters, numbers and single dashes.',
        },
        400
      )
    }
    // The UNIQUE index is the real check — two people claiming the same name in
    // the same second both pass a SELECT, and only one can pass the write.
    try {
      await db
        .prepare('UPDATE users SET handle = ? WHERE id = ? AND handle IS NULL')
        .bind(wanted, user.id)
        .run()
      handle = wanted
    } catch {
      return privateJson({ success: false, error: 'That name is taken.' }, 409)
    }
  }

  if (body.bio !== undefined) {
    await db
      .prepare('UPDATE users SET profile_bio = ? WHERE id = ?')
      .bind(normaliseBio(body.bio), user.id)
      .run()
  }

  if (body.published !== undefined) {
    // Publishing without a handle would switch on a page with no address.
    if (body.published === true && !handle) {
      return privateJson(
        { success: false, error: 'Pick a name for your page first.' },
        400
      )
    }
    await db
      .prepare('UPDATE users SET profile_public = ? WHERE id = ?')
      .bind(body.published === true ? 1 : 0, user.id)
      .run()
  }

  const fresh = await db
    .prepare(SETTINGS_SQL)
    .bind(user.id)
    .first<SettingsRow>()
  return privateJson(settingsOf(fresh))
}
