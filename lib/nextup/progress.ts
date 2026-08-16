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
 * Anything that is not a series episode key is ignored rather than guessed at:
 * the same store holds films, whose keys have no season or episode at all.
 */
export function groupProgress(
  rows: { item_key: string; updated_at: number }[]
): Progress[] {
  const byId = new Map<string, Progress>()

  for (const row of rows) {
    const parts = row.item_key.split(':')
    if (parts.length !== 4 || parts[0] !== 'series') continue
    const [, id, season, episode] = parts
    if (!/^\d+$/.test(id) || !/^\d+$/.test(season) || !/^\d+$/.test(episode)) {
      continue
    }

    const existing = byId.get(id)
    if (existing) {
      existing.watched.add(`${Number(season)}:${Number(episode)}`)
      existing.lastAt = Math.max(existing.lastAt, row.updated_at)
      continue
    }
    byId.set(id, {
      id,
      watched: new Set([`${Number(season)}:${Number(episode)}`]),
      lastAt: row.updated_at,
    })
  }

  return [...byId.values()].sort((a, b) => b.lastAt - a.lastAt)
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
