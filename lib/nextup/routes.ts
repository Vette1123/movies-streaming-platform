/**
 * Up next: the episode to press play on — or the film to resume — for every
 * thing you have started.
 *
 * The one supporter feature that answers a question people ask themselves every
 * evening. Progress lives in `sync_items`: one row per finished episode
 * (`completed`), one row per play (`history`), one row per stopped-position
 * (`resume`). The only outside call is the series shape (how many episodes each
 * season has), and that comes from TMDB through the governed client with a
 * six-hour cache, exactly like the alert sweep's. Films need no outside call at
 * all — their history payload already carries name and poster.
 *
 * The subrequest budget is the ceiling on the whole feature: one invocation gets
 * 50, so SHOW_LIMIT is what keeps this inside it with room to spare. Somebody
 * watching more than a dozen things at once sees the twelve they touched most
 * recently, which is the answer to "what now" in every case that matters.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { fetchClient } from '@/lib/fetch-client'

import {
  mergeQueue,
  nextEpisode,
  percentWatched,
  type QueueEntry,
  type QueueRow,
} from './progress'

/** Shows resolved per request. See the subrequest budget above. */
const SHOW_LIMIT = 12

/**
 * Finished-episode rows read per request.
 *
 * A long-running account has thousands; this reads the most recent slice, which
 * is enough to identify the twelve titles in play. A title untouched for that
 * many rows is not what "up next" means.
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
  kind: 'movie' | 'series'
  name: string
  poster_path: string | null
  /** Series only: where the queue will land you. */
  season?: number
  episode?: number
  /**
   * 0–100 of the whole show, for the bar. Films report how far into the film
   * the synced playback position says they are, and omit the field entirely
   * when no position has ever been recorded — no invented progress.
   */
  percent?: number
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
async function resolve(entry: QueueEntry): Promise<NextUpItem | null> {
  let series: TmdbSeries
  try {
    series = await fetchClient.get<TmdbSeries>(
      `tv/${entry.id}?language=en-US`,
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

  const next = nextEpisode(entry.watched, seasons)
  // Caught up. Deliberately absent rather than listed as "nothing to watch":
  // this panel is a queue, and a queue that lists finished things is a list.
  if (!next) return null

  return {
    id: entry.id,
    kind: 'series',
    // TMDB's artwork is canonical, but its name can be missing while the local
    // payload never is — you played it under some title.
    name: series.name ?? entry.title ?? 'A show you started',
    poster_path: series.poster_path ?? null,
    season: next.season,
    episode: next.episode,
    percent: percentWatched(entry.watched, seasons),
    href: `/tv-shows/${entry.id}?season=${next.season}&episode=${next.episode}`,
  }
}

/**
 * How far into a film somebody is, from the synced position store.
 *
 * Clamped inside 1–95: zero is not worth a bar, and past 95 the player itself
 * clears the position because the right move there is starting over.
 */
function filmPercent(
  positions: Map<string, string>,
  id: string
): number | undefined {
  const payload = positions.get(`movie:${id}`)
  if (!payload) return undefined
  try {
    const parsed = JSON.parse(payload) as {
      position_seconds?: number
      duration_seconds?: number
    }
    const { position_seconds: position, duration_seconds: duration } = parsed
    if (
      typeof position !== 'number' ||
      typeof duration !== 'number' ||
      duration <= 0 ||
      position <= 0
    ) {
      return undefined
    }
    return Math.min(95, Math.max(1, Math.round((position / duration) * 100)))
  } catch {
    return undefined
  }
}

function filmItem(
  entry: QueueEntry,
  positions: Map<string, string>
): NextUpItem {
  return {
    id: entry.id,
    kind: 'movie',
    name: entry.title || 'A film you started',
    poster_path: entry.posterPath ?? null,
    percent: filmPercent(positions, entry.id),
    href: `/movies/${entry.id}`,
  }
}

/**
 * GET /api/next-up — the queue, newest touch first, films and shows together.
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
      `SELECT store, item_key, payload, updated_at FROM sync_items
       WHERE user_id = ? AND store IN ('completed', 'history', 'resume')
         AND payload IS NOT NULL
       ORDER BY updated_at DESC LIMIT ${ROW_LIMIT}`
    )
    .bind(user.id)
    .all<QueueRow>()

  const all = rows.results ?? []
  const entries = mergeQueue(all).slice(0, SHOW_LIMIT)

  // Positions ride along in the same read: films get a real progress bar from
  // them, and it costs zero extra queries.
  const positions = new Map(
    all
      .filter((row) => row.store === 'resume' && row.payload)
      .map((row) => [row.item_key, row.payload as string])
  )

  // In parallel: twelve cached TMDB reads in series would be twelve round trips
  // on the one request somebody is waiting on. The governed client is a no-op in
  // the production runtime, so this is genuinely concurrent there.
  const resolved = await Promise.all(
    entries.map((entry) =>
      entry.kind === 'movie'
        ? Promise.resolve(filmItem(entry, positions))
        : resolve(entry)
    )
  )

  return json({
    success: true,
    items: resolved.filter((item): item is NextUpItem => item !== null),
    /** How many titles were considered, so the empty state can tell the two cases apart. */
    started: entries.length,
  })
}
