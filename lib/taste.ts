/**
 * Turning "I like these five" into something to watch tonight.
 *
 * The onboarding problem this solves: a recommendation engine needs a history,
 * and somebody who arrived thirty seconds ago has none. Asking for five taps is
 * the cheapest way to get one — and it produces a real answer immediately,
 * which is the only argument for signing in that does not depend on believing a
 * feature list.
 *
 * Deliberately built out of what is already there. The picks come from the
 * popular lists the build already fetches, the genres travel with them
 * (`genre_ids` is on every TMDB list row), and the recommendation is one
 * `/api/filter` discover call — the same endpoint the browse sidebar uses, with
 * the same edge cache in front of it. No endpoint, no model, no store.
 */

import type { FilterParams } from '@/types/filter'

export interface TastePick {
  id: number
  type: 'movie' | 'series'
  title: string
  poster_path: string | null
  genre_ids: number[]
}

/** Enough taps to mean something; few enough that nobody abandons halfway. */
export const TASTE_MIN = 3
export const TASTE_MAX = 8

/** How many genres are handed to the discover call. */
const GENRE_DEPTH = 3

/**
 * The genres somebody's picks actually share, most-picked first.
 *
 * Ties break on the order the genre was first seen, which is the order of the
 * picks themselves — so two genres picked once each resolve to whichever the
 * person chose first rather than to whichever TMDB happens to number lower.
 */
export function topGenres(picks: TastePick[], depth = GENRE_DEPTH): number[] {
  const counts = new Map<number, { n: number; first: number }>()
  let seen = 0

  for (const pick of picks) {
    for (const genre of pick.genre_ids ?? []) {
      const entry = counts.get(genre)
      if (entry) {
        entry.n++
        continue
      }
      counts.set(genre, { n: 1, first: seen++ })
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)
    .slice(0, depth)
    .map(([genre]) => genre)
}

/**
 * Which half of the catalogue to search, from what was picked.
 *
 * A tie goes to film, because the picker shows more of them and a film is the
 * answer to "what do I watch tonight" more often than a series is.
 */
export function tasteMediaType(picks: TastePick[]): 'movie' | 'tv' {
  const series = picks.filter((pick) => pick.type === 'series').length
  return series > picks.length / 2 ? 'tv' : 'movie'
}

/**
 * The discover params for a set of picks.
 *
 * `with_genres` is comma-separated, which TMDB reads as OR — deliberately, not
 * as a compromise. AND across three genres returns almost nothing, and the
 * question being answered is "more like these", not "all of these at once".
 */
export function tasteQuery(picks: TastePick[]): {
  mediaType: 'movie' | 'tv'
  params: FilterParams
} {
  return {
    mediaType: tasteMediaType(picks),
    params: {
      with_genres: topGenres(picks).join(','),
      // Popularity alone returns whatever is trending regardless of quality;
      // rating alone returns obscure titles with four votes. This is the pair
      // the browse filters already settled on.
      sort_by: 'popularity.desc',
      'vote_count.gte': 300,
    },
  }
}

/** Nothing to recommend from, said as a question rather than an error. */
export const tastePrompt = (picked: number): string => {
  if (picked === 0) return `Pick ${TASTE_MIN} you like.`
  if (picked < TASTE_MIN) return `${TASTE_MIN - picked} more to go.`
  return `${picked} picked. Ready when you are.`
}
