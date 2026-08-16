/**
 * Up next: the episode to press play on, for every show you have started.
 *
 * The one supporter feature that answers a question people ask themselves every
 * evening. Everything it needs about progress is already in `sync_items` — one
 * row per finished episode — so the only outside call is the series shape (how
 * many episodes each season has), and that comes from TMDB through the governed
 * client with a six-hour cache, exactly like the alert sweep's.
 *
 * The subrequest budget is the ceiling on the whole feature: one invocation gets
 * 50, so SHOW_LIMIT is what keeps this inside it with room to spare. Somebody
 * watching more than a dozen shows at once sees the twelve they touched most
 * recently, which is the answer to "what now" in every case that matters.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { fetchClient } from '@/lib/fetch-client'

import {
  groupProgress,
  nextEpisode,
  percentWatched,
  type Progress,
} from './progress'

/** Shows resolved per request. See the subrequest budget above. */
const SHOW_LIMIT = 12

/**
 * Finished-episode rows read per request.
 *
 * A long-running account has thousands; this reads the most recent slice, which
 * is enough to identify the twelve shows in play. A show untouched for that many
 * episodes is not what "up next" means.
 */
const ROW_LIMIT = 2000

/** Same six hours the sweep uses: a season's episode count does not move hourly. */
const TMDB_TTL = 6 * 60 * 60

interface TmdbSeries {
  name?: string
  poster_path?: string | null
  seasons?: { season_number?: number; episode_count?: number }[] | null
}

export interface NextUpItem {
  id: string
  name: string
  poster_path: string | null
  season: number
  episode: number
  /** 0–100 of the whole show, for the bar. */
  percent: number
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

/** One show, resolved — or null when it is finished, unknown, or TMDB blinked. */
async function resolve(progress: Progress): Promise<NextUpItem | null> {
  let series: TmdbSeries
  try {
    series = await fetchClient.get<TmdbSeries>(
      `tv/${progress.id}?language=en-US`,
      {},
      true,
      TMDB_TTL
    )
  } catch {
    // A dead id or a TMDB blip. One missing row is a far better outcome than a
    // failed panel, so this show simply does not appear this time.
    return null
  }

  const seasons = (series.seasons ?? [])
    .map((season) => ({
      season_number: Number(season.season_number ?? -1),
      episode_count: Number(season.episode_count ?? 0),
    }))
    .filter((season) => Number.isFinite(season.season_number))

  const next = nextEpisode(progress.watched, seasons)
  // Caught up. Deliberately absent rather than listed as "nothing to watch":
  // this panel is a queue, and a queue that lists finished things is a list.
  if (!next) return null

  return {
    id: progress.id,
    name: series.name ?? 'A show you started',
    poster_path: series.poster_path ?? null,
    season: next.season,
    episode: next.episode,
    percent: percentWatched(progress.watched, seasons),
    href: `/tv-shows/${progress.id}?season=${next.season}&episode=${next.episode}`,
  }
}

/**
 * GET /api/next-up — the queue, newest show first.
 */
export async function handleNextUp(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)

  // 402 rather than 403, like every other supporter route: the client shows the
  // offer instead of an error.
  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'Up next is a supporter feature.' },
      402
    )
  }

  const rows = await db
    .prepare(
      `SELECT item_key, updated_at FROM sync_items
       WHERE user_id = ? AND store = 'completed' AND payload IS NOT NULL
       ORDER BY updated_at DESC LIMIT ${ROW_LIMIT}`
    )
    .bind(user.id)
    .all<{ item_key: string; updated_at: number }>()

  const shows = groupProgress(rows.results ?? []).slice(0, SHOW_LIMIT)

  // In parallel: twelve cached TMDB reads in series would be twelve round trips
  // on the one request somebody is waiting on. The governed client is a no-op in
  // the production runtime, so this is genuinely concurrent there.
  const resolved = await Promise.all(shows.map(resolve))

  return json({
    success: true,
    items: resolved.filter((item): item is NextUpItem => item !== null),
    /** How many shows were considered, so the empty state can tell the two cases apart. */
    started: shows.length,
  })
}
