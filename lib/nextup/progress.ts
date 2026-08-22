/**
 * Where you are in a show, and which episode comes next.
 *
 * Pure and separate from the route, because this is the part that can be wrong
 * in a way nobody reports: an off-by-one here sends somebody to an episode they
 * have already seen, or skips one, and both feel like the app being careless
 * with the only thing it is supposed to remember.
 *
 * The only input is the set of episodes ticked off. Reely does not store a
 * "progress" number anywhere — it stores one row per finished episode, which is
 * the truth that survives watching things out of order.
 */

/** `series:1399:3:2` — the sync key of one finished episode. */
export interface Progress {
  /** TMDB series id. */
  id: string
  /** 'S:E' for every episode ticked off. */
  watched: Set<string>
  /** When this show was last touched, so the newest thing you are watching is first. */
  lastAt: number
}

/**
 * The bits of a synced payload the queue needs, decoupled from WatchedItem:
 * history rows carry their own artwork and title, so a film never costs a
 * TMDB call to appear.
 */
interface ResumePayload {
  title?: string
  poster_path?: string | null
}

/** One raw `sync_items` row, as the queue route reads it. */
export interface QueueRow {
  store: string
  item_key: string
  payload: string | null
  updated_at: number
}

export type QueueKind = 'movie' | 'series'

/**
 * One "pick up where you left off" candidate, before TMDB resolution.
 */
export interface QueueEntry {
  id: string
  kind: QueueKind
  /** Newest touch wins the top of the row. */
  lastAt: number
  /** Series only: every ticked-or-played episode, as 's:e'. */
  watched: Set<string>
  /** Movies carry these straight from the history payload. */
  title?: string
  posterPath?: string | null
}

function parsePayload(payload: string | null): ResumePayload | null {
  if (!payload) return null
  try {
    const parsed = JSON.parse(payload) as ResumePayload
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Merge every store that knows what you played into one queue.
 *
 * Three sources, one pass each:
 *
 * - **completed** episodes group per show exactly as before — the truth that
 *   survives out-of-order watching.
 * - **history** rows are what "I pressed play" writes. A FILM here becomes a
 *   queue entry of its own (resume target: the film), which is the part the
 *   old queue silently dropped: starting a movie made it vanish from "where
 *   you left off". A SERIES row carries the episode that was playing; when the
 *   show has no completed episodes yet — anything started at S01E01 — it seeds
 *   one, so nextEpisode answers E2 instead of the show not existing.
 * - A film also ticked off in **completed** is finished, and finished things do
 *   not come back as resume cards.
 */
export function mergeQueue(rows: QueueRow[]): QueueEntry[] {
  const shows = new Map<string, QueueEntry>()
  const films = new Map<string, QueueEntry>()
  const finishedFilms = new Set<string>()

  for (const row of rows) {
    const parts = row.item_key.split(':')

    if (row.store === 'completed') {
      const grouped = groupRow(parts, row.updated_at)
      if (grouped) {
        const existing = shows.get(grouped.id)
        if (existing) {
          grouped.watched.forEach((key) => existing.watched.add(key))
          existing.lastAt = Math.max(existing.lastAt, grouped.lastAt)
        } else {
          shows.set(grouped.id, grouped)
        }
        continue
      }
      // `movie:<id>` — a finished film is remembered only as an exclusion.
      if (parts.length === 2 && parts[0] === 'movie') {
        finishedFilms.add(parts[1])
      }
      continue
    }

    if (row.store === 'history') {
      // `movie:<id>` — pressed play on a film.
      if (parts.length === 2 && parts[0] === 'movie') {
        const payload = parsePayload(row.payload)
        if (!payload) continue
        const existing = films.get(parts[1])
        if (existing) {
          existing.lastAt = Math.max(existing.lastAt, row.updated_at)
          continue
        }
        films.set(parts[1], {
          id: parts[1],
          kind: 'movie',
          lastAt: row.updated_at,
          watched: new Set(),
          title: payload.title ?? undefined,
          posterPath: payload.poster_path ?? null,
        })
        continue
      }
      // `series:<id>:<s>:<e>` — pressed play on an episode. If completion has
      // nothing on this show, the played episode itself seeds the walk.
      if (parts.length === 4 && parts[0] === 'series') {
        const grouped = groupRow(parts, row.updated_at)
        if (!grouped) continue
        const existing = shows.get(grouped.id)
        if (existing) {
          existing.lastAt = Math.max(existing.lastAt, row.updated_at)
          continue
        }
        shows.set(grouped.id, grouped)
      }
    }
  }

  return [...shows.values(), ...films.values()]
    .filter((entry) => !(entry.kind === 'movie' && finishedFilms.has(entry.id)))
    .sort((a, b) => b.lastAt - a.lastAt)
}

/** One valid episode key → a single-show Progress, or null for anything else. */
function groupRow(
  parts: string[],
  updatedAt: number
): {
  id: string
  kind: QueueKind
  lastAt: number
  watched: Set<string>
} | null {
  if (parts.length !== 4 || parts[0] !== 'series') return null
  const [, id, season, episode] = parts
  if (!/^\d+$/.test(id) || !/^\d+$/.test(season) || !/^\d+$/.test(episode)) {
    return null
  }
  return {
    id,
    kind: 'series',
    lastAt: updatedAt,
    watched: new Set([`${Number(season)}:${Number(episode)}`]),
  }
}

export interface SeasonShape {
  season_number: number
  episode_count: number
}

export interface NextEpisode {
  season: number
  episode: number
}

/**
 * Group finished-episode keys by series.
 *
 * A thin view over `mergeQueue` restricted to what completion alone knows —
 * kept because the walk (`nextEpisode`) reasons about one show at a time, and
 * because the existing tests pin it directly.
 */
export function groupProgress(
  rows: { item_key: string; updated_at: number }[]
): Progress[] {
  return mergeQueue(
    rows.map((row) => ({
      store: 'completed',
      item_key: row.item_key,
      payload: null,
      updated_at: row.updated_at,
    }))
  )
    .filter((entry) => entry.kind === 'series')
    .map((entry) => ({
      id: entry.id,
      watched: entry.watched,
      lastAt: entry.lastAt,
    }))
}

/**
 * The first episode not ticked off, walking seasons in order.
 *
 * Not "the one after the highest you watched": somebody who watched S02E05 out
 * of curiosity and then went back to S01E01 is mid-season one, and the highest
 * number would march them past everything they have not seen. The first gap is
 * the honest answer, and it is also self-correcting — tick the gap off and the
 * next call moves on.
 *
 * Season 0 is skipped. TMDB files specials there, they are almost never watched
 * in order, and a show would otherwise permanently suggest a Christmas special
 * from 2011.
 */
export function nextEpisode(
  watched: Set<string>,
  seasons: SeasonShape[]
): NextEpisode | null {
  const ordered = [...seasons]
    .filter((season) => season.season_number > 0 && season.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number)

  for (const season of ordered) {
    for (let episode = 1; episode <= season.episode_count; episode++) {
      if (!watched.has(`${season.season_number}:${episode}`)) {
        return { season: season.season_number, episode }
      }
    }
  }
  return null
}

/** How much of a show is behind you, 0–100, for the bar under each row. */
export function percentWatched(
  watched: Set<string>,
  seasons: SeasonShape[]
): number {
  const total = seasons
    .filter((season) => season.season_number > 0)
    .reduce((sum, season) => sum + Math.max(0, season.episode_count), 0)
  if (total === 0) return 0
  // Capped: an episode count can shrink when TMDB reorganises a season, and a
  // progress bar past 100% is a bug somebody screenshots.
  return Math.min(100, Math.round((watched.size / total) * 100))
}
