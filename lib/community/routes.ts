/**
 * The public square: every list somebody published, and every profile somebody
 * made public.
 *
 * It exists for one reason. Reely's whole personal half — a watchlist, a
 * history, ratings, lists — is invisible from the outside, so the site reads as
 * a catalogue anyone could have built, and there is nothing on it that makes
 * signing in look worth doing. A directory of other people's shelves is the
 * cheapest honest answer: proof that the account half is used, a page a search
 * engine can index, and a wall of things worth stealing with "make your own" at
 * the end of it.
 *
 * Everything here is a read of rows that already exist for another reason, so
 * the feature adds no writes, no sweep and no new table — only two indexes.
 */

import { isEntitled, type BillingRow } from '@/lib/billing/entitlement'

/** How many of each the directory shows. A page, not an archive. */
export const DIRECTORY_LISTS = 24
export const DIRECTORY_PEOPLE = 18

/** Posters kept per card: enough for a strip, few enough to stay small. */
const CARD_POSTERS = 5

export interface DirectoryList {
  slug: string
  name: string
  description: string | null
  owner: string | null
  handle: string | null
  count: number
  /** A filter rather than a fixed set of titles — it has no stored posters. */
  smart: boolean
  posters: string[]
  updated_at: number
}

export interface DirectoryPerson {
  handle: string
  name: string | null
  picture: string | null
  bio: string | null
  lists: number
}

export interface Directory {
  lists: DirectoryList[]
  people: DirectoryPerson[]
  /** How many accounts are entitled right now. Shown, so it must be true. */
  supporters: number
}

interface ListRow {
  slug: string
  name: string
  description: string | null
  items: string
  smart_query: string | null
  updated_at: number
  owner: string | null
  handle: string | null
}

interface PersonRow extends BillingRow {
  handle: string
  name: string | null
  picture: string | null
  profile_bio: string | null
  lists: number
}

/**
 * The posters on a card, from the list's stored items.
 *
 * Defensive about the payload for the same reason `safeItems` is: these rows
 * were written by a client, and a directory is the one page where one broken
 * row would take down everybody else's.
 */
export function cardPosters(raw: string): { count: number; posters: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { count: 0, posters: [] }
  }
  if (!Array.isArray(parsed)) return { count: 0, posters: [] }

  const posters: string[] = []
  for (const item of parsed) {
    if (posters.length >= CARD_POSTERS) break
    const path = (item as { poster_path?: unknown })?.poster_path
    if (typeof path === 'string' && path.length > 1) posters.push(path)
  }
  return { count: parsed.length, posters }
}

/**
 * "412 people keep Reely free", or the honest version when almost nobody does.
 *
 * A number this small is worse than no number: "3 supporters" reads as a dead
 * site rather than a young one. Below the floor it says the same true thing
 * without counting.
 */
export const SUPPORTER_FLOOR = 12

export function supporterLine(count: number): string {
  if (count < SUPPORTER_FLOOR) return 'Supporters keep Reely free for everyone.'
  return `${count} people keep Reely free for everyone.`
}

/**
 * Everything the directory shows, in three indexed reads.
 *
 * The entitlement filter on people happens in JavaScript because `isEntitled`
 * is the one place that decision is made and it reads a JSON grants column —
 * duplicating it as SQL is how the two drift. The COUNT is deliberately a
 * cruder SQL approximation of the same question: it is a number on a page, not
 * an access decision, and a query that scans every row to be exact would be the
 * most expensive thing on the site.
 */
export async function loadDirectory(
  db: D1Database,
  now: number
): Promise<Directory> {
  const [lists, people, supporters] = await Promise.all([
    db
      .prepare(
        `SELECT lists.slug, lists.name, lists.description, lists.items,
                lists.smart_query, lists.updated_at,
                users.name AS owner, users.handle
         FROM lists JOIN users ON users.id = lists.user_id
         WHERE lists.published = 1
         ORDER BY lists.updated_at DESC
         LIMIT ${DIRECTORY_LISTS}`
      )
      .all<ListRow>(),
    db
      .prepare(
        `SELECT users.handle, users.name, users.picture, users.profile_bio,
                users.grants, users.sub_status, users.sub_ends_at,
                users.sub_past_due_since,
                (SELECT COUNT(*) FROM lists
                  WHERE lists.user_id = users.id AND lists.published = 1) AS lists
         FROM users
         WHERE users.profile_public = 1 AND users.handle IS NOT NULL
         ORDER BY users.created_at ASC
         LIMIT ${DIRECTORY_PEOPLE}`
      )
      .all<PersonRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM users
         WHERE grants IS NOT NULL
            OR (sub_status IN ('active', 'canceled')
                AND (sub_ends_at IS NULL OR sub_ends_at > ?))`
      )
      .bind(now)
      .first<{ n: number }>(),
  ])

  return {
    lists: (lists.results ?? []).map((row) => {
      const { count, posters } = cardPosters(row.items)
      return {
        slug: row.slug,
        name: row.name,
        description: row.description,
        owner: row.owner,
        handle: row.handle,
        count,
        smart: row.smart_query !== null,
        posters,
        updated_at: row.updated_at,
      }
    }),
    people: (people.results ?? [])
      .filter((row) => isEntitled(row, now))
      .map((row) => ({
        handle: row.handle,
        name: row.name,
        picture: row.picture,
        bio: row.profile_bio,
        lists: row.lists,
      })),
    supporters: supporters?.n ?? 0,
  }
}

/**
 * GET /api/community — the directory, as JSON.
 *
 * Publicly cacheable, unlike every other account route: nothing here belongs to
 * the caller. Ten minutes is long enough that a page somebody links to costs
 * one query per colo, and short enough that publishing a list shows up while
 * the person who published it is still looking.
 */
export async function handleCommunity(db: D1Database): Promise<Response> {
  const directory = await loadDirectory(db, Date.now())
  return new Response(JSON.stringify({ success: true, ...directory }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=600',
    },
  })
}
