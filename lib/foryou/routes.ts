/**
 * Because you watched — recommendations seeded from your own history.
 *
 * TMDB's `/recommendations` already exists on every detail page, keyed to the
 * title being looked at. This is the same endpoint pointed at the last few
 * things somebody actually finished, with everything they have already seen or
 * saved filtered back out — which is the difference between "more like this
 * one" and "something to watch tonight".
 *
 * Costs SEED_COUNT subrequests and two D1 reads. Nothing is stored: the answer
 * changes every time the history does, and a cached row would be stale the
 * moment somebody ticks anything off.
 *
 * The seeds are chosen by SCORE, not by recency. Somebody's own ratings are the
 * strongest signal in the account and they were being ignored: the last three
 * things finished included whatever was put on in the background, while a film
 * rated 10 sat two rows down. Anything scored below LIKED is not a seed at all —
 * "you finished it" and "you liked it" are different claims, and only one of
 * them is worth being asked to watch more of.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { fetchClient } from '@/lib/fetch-client'

/** How many finished titles seed the list. Each one is a subrequest. */
const SEED_COUNT = 3
/**
 * The score at which a title stops being evidence of taste.
 *
 * Six out of ten, because that is where people stop recommending things.
 * Anything at or below it is excluded from the seeds entirely rather than
 * merely ranked last — a row of "more like the film you gave a 3" is worse than
 * a shorter row.
 */
const LIKED = 6
/** Rows read to find those seeds and to know what to exclude. */
const ROW_LIMIT = 500
/** What comes back. Two rows of five on a wide screen. */
const MAX_RESULTS = 20
/** Six hours, like every other sweep-adjacent read: recommendations barely move. */
const TMDB_TTL = 6 * 60 * 60

interface TmdbResult {
  id?: number
  title?: string
  name?: string
  poster_path?: string | null
  vote_average?: number
  media_type?: string
}

export interface ForYouItem {
  id: number
  type: 'movie' | 'series'
  title: string
  poster_path: string | null
  vote_average: number | null
  /** The title this was suggested from, so the row can say why it is here. */
  because: string
  /** And what they scored it, when that is why it was picked. */
  because_rating: number | null
  href: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

export interface Seed {
  id: string
  type: 'movie' | 'series'
  title: string
  /** What this account scored it, if it scored it. Drives the "because" line. */
  rating: number | null
}

/** A finished title, before it is known whether it is one of the seeds. */
export interface SeedCandidate extends Seed {
  /** Position in the account's history, newest first. The recency tiebreak. */
  rank: number
}

/**
 * The few titles worth asking TMDB about.
 *
 * A rated title always beats an unrated one, a higher score beats a lower one,
 * and recency only breaks a tie. Rated at or below LIKED is dropped: it is not
 * a weaker signal, it is the opposite signal.
 *
 * Pure, because the whole feature is this ordering — everything around it is
 * one fetch per result — and because getting it wrong is invisible in a
 * screenshot. See tests/for-you.test.ts.
 */
export function chooseSeeds(
  candidates: SeedCandidate[],
  count: number
): Seed[] {
  return candidates
    .filter((seed) => seed.rating === null || seed.rating > LIKED)
    .sort((a, b) => {
      if (a.rating !== b.rating) {
        // Nulls sort last: a score is a statement, an absence is not.
        if (a.rating === null) return 1
        if (b.rating === null) return -1
        return b.rating - a.rating
      }
      return a.rank - b.rank
    })
    .slice(0, count)
    .map(({ id, type, title, rating }) => ({ id, type, title, rating }))
}

const safePayload = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    // A row written by an older shape. The id is what matters here.
    return {}
  }
}

const titleOf = (payload: Record<string, unknown>): string => {
  if (typeof payload.title === 'string' && payload.title) return payload.title
  if (typeof payload.name === 'string' && payload.name) return payload.name
  return 'something you watched'
}

/** The base media key, with any season/episode suffix removed. */
const baseKey = (itemKey: string): string =>
  itemKey.split(':').slice(0, 2).join(':')

/**
 * What to recommend from, and what to leave out.
 *
 * One query over every personal store rather than one per store: the exclusion
 * set needs all of them anyway, and the seeds are just the newest few rows of it
 * that came from something finished.
 */
async function readLibrary(
  db: D1Database,
  userId: string
): Promise<{ seeds: Seed[]; exclude: Set<string> }> {
  const rows = await db
    .prepare(
      `SELECT store, item_key, payload FROM sync_items
       WHERE user_id = ? AND payload IS NOT NULL
       ORDER BY updated_at DESC LIMIT ${ROW_LIMIT}`
    )
    .bind(userId)
    .all<{ store: string; item_key: string; payload: string }>()

  const exclude = new Set<string>()
  const candidates: SeedCandidate[] = []
  const seen = new Set<string>()
  // Ratings arrive in the same pass and in no particular order relative to the
  // history rows they belong to, so they are stitched on after the loop.
  const ratings = new Map<string, number>()

  for (const row of rows.results ?? []) {
    const key = baseKey(row.item_key)
    // Everything already in the library is excluded, whatever store it is in:
    // recommending something that is sitting on somebody's watchlist is the
    // fastest way to look like the feature is not reading their account.
    exclude.add(key)

    const payload = safePayload(row.payload)

    if (row.store === 'reviews') {
      const rating = Number(payload.rating)
      if (Number.isFinite(rating) && rating > 0) ratings.set(key, rating)
      continue
    }

    // Seeded from things finished, not from things merely opened: a title
    // abandoned after four minutes is not a statement of taste.
    if (row.store !== 'history' && row.store !== 'completed') continue
    if (seen.has(key)) continue

    const [kind, id] = key.split(':')
    if (!/^\d+$/.test(id ?? '')) continue

    seen.add(key)
    candidates.push({
      id,
      type: kind === 'series' ? 'series' : 'movie',
      title: titleOf(payload),
      rating: null,
      rank: candidates.length,
    })
  }

  for (const candidate of candidates) {
    candidate.rating = ratings.get(`${candidate.type}:${candidate.id}`) ?? null
  }

  return { seeds: chooseSeeds(candidates, SEED_COUNT), exclude }
}

/** TMDB's recommendations for one seed, already shaped for the client. */
async function recommendationsFor(seed: Seed): Promise<ForYouItem[]> {
  const path = seed.type === 'series' ? 'tv' : 'movie'
  try {
    const body = await fetchClient.get<{ results?: TmdbResult[] }>(
      `${path}/${seed.id}/recommendations?language=en-US&page=1`,
      {},
      true,
      TMDB_TTL
    )
    return (body.results ?? [])
      .map((result) => shape(result, seed))
      .filter((item): item is ForYouItem => item !== null)
  } catch {
    // One dead seed must not empty the whole row.
    return []
  }
}

function shape(result: TmdbResult, seed: Seed): ForYouItem | null {
  const id = Number(result.id)
  if (!Number.isInteger(id) || id <= 0) return null

  // `/movie/x/recommendations` can return TV entries and vice versa, so the
  // media_type on the result wins over the seed's own kind where it exists.
  const isSeries =
    result.media_type === 'tv' || (!result.title && !!result.name)
  const title = result.title ?? result.name
  if (!title) return null

  return {
    id,
    type: isSeries ? 'series' : 'movie',
    title,
    poster_path: result.poster_path ?? null,
    vote_average:
      typeof result.vote_average === 'number' && result.vote_average > 0
        ? Math.round(result.vote_average * 10) / 10
        : null,
    because: seed.title,
    because_rating: seed.rating,
    href: isSeries ? `/tv-shows/${id}` : `/movies/${id}`,
  }
}

/**
 * Interleave the seeds' results rather than concatenating them.
 *
 * Three seeds concatenated means the first seed fills the visible row and the
 * other two are below the fold — the list looks like it read one title. Round
 * robin puts all three in the first handful, which is what makes it read as
 * "your taste" rather than "more of that one film".
 */
export function interleave(lists: ForYouItem[][]): ForYouItem[] {
  const out: ForYouItem[] = []
  const longest = Math.max(0, ...lists.map((list) => list.length))
  for (let index = 0; index < longest; index++) {
    for (const list of lists) {
      const item = list[index]
      if (item) out.push(item)
    }
  }
  return out
}

/** Drop anything already in the library, and anything suggested twice. */
export function dedupe(
  items: ForYouItem[],
  exclude: Set<string>,
  limit: number
): ForYouItem[] {
  const seen = new Set<string>()
  const out: ForYouItem[] = []
  for (const item of items) {
    const key = `${item.type}:${item.id}`
    if (exclude.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= limit) break
  }
  return out
}

/** GET /api/for-you */
export async function handleForYou(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)
  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'Recommendations are a supporter feature.' },
      402
    )
  }

  const { seeds, exclude } = await readLibrary(db, user.id)
  if (seeds.length === 0) {
    return json({ success: true, items: [], seeds: [] })
  }

  const lists = await Promise.all(seeds.map(recommendationsFor))

  return json({
    success: true,
    items: dedupe(interleave(lists), exclude, MAX_RESULTS),
    seeds: seeds.map((seed) => seed.title),
  })
}
