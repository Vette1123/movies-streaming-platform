/**
 * Where you are in a show, and which episode comes next.
 *
 * Pure and separate from the route, because this is the part that can be wrong
 * in a way nobody reports: an off-by-one here sends somebody to an episode they
 * have already seen, or skips one, and both feel like the app being careless
 * with the only thing it is supposed to remember.
 *
 * Two inputs: the episode last pressed play on (the `history` row, one per
 * show) and the set of episodes ticked off (`completed`, one row per finished
 * episode). The bookmark is the play; the ticks only say whether to move past
 * it. The show page's own "Resume S2 · E4" caption (hooks/use-series-progress)
 * walks the same function, so the homepage and the page cannot disagree.
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

export interface EpisodeRef {
  season: number
  episode: number
}

/**
 * One "pick up where you left off" candidate, before TMDB resolution.
 */
export interface QueueEntry {
  id: string
  kind: QueueKind
  /** Newest touch wins the top of the row. */
  lastAt: number
  /** Series only: every episode ticked off, as 's:e'. Never a mere play. */
  watched: Set<string>
  /**
   * Series only: the bookmark. The newest episode pressed play on, else — for
   * a show only ever ticked off by hand — the newest episode ticked off.
   */
  last?: EpisodeRef
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

/** `series:<id>:<s>:<e>` → its parts, or null for anything else. */
function episodeOf(parts: string[]): (EpisodeRef & { id: string }) | null {
  if (parts.length !== 4 || parts[0] !== 'series') return null
  const [, id, season, episode] = parts
  if (!/^\d+$/.test(id) || !/^\d+$/.test(season) || !/^\d+$/.test(episode)) {
    return null
  }
  return { id, season: Number(season), episode: Number(episode) }
}

interface Mark {
  at: EpisodeRef
  stamp: number
}

/** One show while the rows are read: its ticks, plus both kinds of bookmark. */
interface ShowRows {
  lastAt: number
  watched: Set<string>
  played?: Mark
  ticked?: Mark
}

/** Keeps whichever of two marks is newer. Row order is never relied on. */
const newer = (current: Mark | undefined, next: Mark): Mark =>
  current && current.stamp >= next.stamp ? current : next

/**
 * Merge every store that knows what you played into one queue.
 *
 * - **completed** episodes group per show — what you finished, which survives
 *   watching out of order. A film ticked off here is finished, and finished
 *   things do not come back as resume cards.
 * - **history** rows are what "I pressed play" writes. A FILM here becomes a
 *   queue entry of its own (resume target: the film). A SERIES row is the
 *   bookmark. Two devices can leave two rows for one show (the key carries the
 *   episode), so the newest one wins.
 *
 * A play is deliberately NOT counted as a finish. It used to seed the ticked
 * set, which made a show started at S01E01 answer E2 — and made a show started
 * anywhere else answer S01E01, the first episode nobody had ticked off.
 */
export function mergeQueue(rows: QueueRow[]): QueueEntry[] {
  const shows = new Map<string, ShowRows>()
  const films = new Map<string, QueueEntry>()
  const finishedFilms = new Set<string>()

  const showOf = (id: string, stamp: number) => {
    const existing = shows.get(id)
    if (existing) {
      existing.lastAt = Math.max(existing.lastAt, stamp)
      return existing
    }
    const created: ShowRows = { lastAt: stamp, watched: new Set<string>() }
    shows.set(id, created)
    return created
  }

  for (const row of rows) {
    const parts = row.item_key.split(':')
    const episode = episodeOf(parts)

    if (row.store === 'completed') {
      if (episode) {
        const show = showOf(episode.id, row.updated_at)
        show.watched.add(`${episode.season}:${episode.episode}`)
        show.ticked = newer(show.ticked, { at: episode, stamp: row.updated_at })
        continue
      }
      // `movie:<id>` — a finished film is remembered only as an exclusion.
      if (parts.length === 2 && parts[0] === 'movie') {
        finishedFilms.add(parts[1])
      }
      continue
    }

    if (row.store !== 'history') continue

    if (episode) {
      const show = showOf(episode.id, row.updated_at)
      show.played = newer(show.played, { at: episode, stamp: row.updated_at })
      continue
    }

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
    }
  }

  const series: QueueEntry[] = [...shows].map(([id, show]) => {
    const mark = show.played ?? show.ticked
    return {
      id,
      kind: 'series',
      lastAt: show.lastAt,
      watched: show.watched,
      ...(mark
        ? { last: { season: mark.at.season, episode: mark.at.episode } }
        : {}),
    }
  })

  return [...series, ...films.values()]
    .filter((entry) => !(entry.kind === 'movie' && finishedFilms.has(entry.id)))
    .sort((a, b) => b.lastAt - a.lastAt)
}

export interface SeasonShape {
  season_number: number
  episode_count: number
}

/**
 * Group finished-episode keys by series.
 *
 * A thin view over `mergeQueue` restricted to what completion alone knows —
 * kept because the existing tests pin it directly.
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

export interface ResumeTarget extends EpisodeRef {
  /**
   * false: the bookmarked episode is unfinished, so pick it back up.
   * true: it is finished, and this is the first unfinished one after it.
   */
  isNext: boolean
}

/**
 * Where "continue" lands: the bookmarked episode while it is unfinished, else
 * the first unfinished episode after it. Null when everything from there to
 * the last aired episode is ticked off.
 *
 * It only ever walks FORWARD. An episode skipped earlier in the run is not
 * where somebody is — the bookmark is — and walking back to the first gap is
 * exactly what sent people from S03 to S01E01.
 *
 * Season 0 is never walked into: TMDB files specials there and they are almost
 * never watched in order. A bookmark already IN season 0 is still honoured
 * while it is unfinished.
 */
export function resumeEpisode(
  last: EpisodeRef,
  watched: Set<string>,
  seasons: SeasonShape[]
): ResumeTarget | null {
  if (!watched.has(`${last.season}:${last.episode}`)) {
    return { season: last.season, episode: last.episode, isNext: false }
  }
  const ordered = [...seasons]
    .filter((season) => season.season_number > 0 && season.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number)
  const from = ordered.findIndex(
    (season) => season.season_number === last.season
  )
  if (from === -1) return null

  let episode = last.episode + 1
  for (let index = from; index < ordered.length; index++) {
    const season = ordered[index]
    for (; episode <= season.episode_count; episode++) {
      if (!watched.has(`${season.season_number}:${episode}`)) {
        return { season: season.season_number, episode, isNext: true }
      }
    }
    episode = 1
  }
  return null
}

/** The queue's answer for one show, or null when it is caught up. */
export function queueTarget(
  entry: QueueEntry,
  seasons: SeasonShape[]
): ResumeTarget | null {
  if (!entry.last) return null
  return resumeEpisode(entry.last, entry.watched, seasons)
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
