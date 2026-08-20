import {
  type FilterParams,
  type MediaFilter,
  type SortOption,
} from '@/types/filter'

import { CERTIFICATION_COUNTRY, DEFAULT_WATCH_REGION } from './filter-options'

/**
 * The browse filter, as data rather than as URL state.
 *
 * This mapping used to live inside `useMediaFilter`, where only a mounted
 * browse page could reach it. Three things now need it — the browse page, a
 * smart list resolving itself in the client, and the Worker resolving that same
 * smart list to render a shared page — so it lives here, pure, and the hook
 * calls it like everybody else.
 *
 * The defaults are load-bearing, not decoration: `clearOnDefault` means a
 * filter at its default is ABSENT from the URL, so reading a missing key as
 * anything but the default silently changes what a saved query means.
 */
export const FILTER_DEFAULTS = {
  selectedGenres: [] as number[],
  excludedGenres: [] as number[],
  sortBy: 'popularity.desc' as SortOption,
  minRating: 0,
  maxRating: 10,
  minVotes: 0,
  fromDate: '',
  toDate: '',
  minRuntime: 0,
  maxRuntime: 300,
  originalLanguage: '',
  certification: '',
  watchProviders: [] as number[],
  watchRegion: DEFAULT_WATCH_REGION,
}

/** nuqs' `parseAsArrayOf` separator. Changing it changes every saved query. */
const SEPARATOR = ','

const numbers = (raw: string | null): number[] => {
  if (!raw) return []
  return raw
    .split(SEPARATOR)
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value))
}

const number = (raw: string | null, fallback: number): number => {
  if (raw === null) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

/**
 * A browse query string back into the filter it describes.
 *
 * The inverse of what nuqs writes into the URL, and deliberately forgiving:
 * a saved query is months old by the time it is read again, and one key this
 * version does not recognise must not empty the whole list.
 */
export function parseFilterQuery(query: string): MediaFilter {
  const params = new URLSearchParams(
    query.startsWith('?') ? query.slice(1) : query
  )
  const text = (key: string): string | undefined =>
    params.get(key)?.trim() || undefined

  return {
    selectedGenres: numbers(params.get('selectedGenres')),
    excludedGenres: numbers(params.get('excludedGenres')),
    sortBy: (text('sortBy') ?? FILTER_DEFAULTS.sortBy) as SortOption,
    minRating: number(params.get('minRating'), FILTER_DEFAULTS.minRating),
    maxRating: number(params.get('maxRating'), FILTER_DEFAULTS.maxRating),
    minVotes: number(params.get('minVotes'), FILTER_DEFAULTS.minVotes),
    fromDate: text('fromDate'),
    toDate: text('toDate'),
    minRuntime: number(params.get('minRuntime'), FILTER_DEFAULTS.minRuntime),
    maxRuntime: number(params.get('maxRuntime'), FILTER_DEFAULTS.maxRuntime),
    originalLanguage: text('originalLanguage'),
    certification: text('certification'),
    watchProviders: numbers(params.get('watchProviders')),
    watchRegion: text('watchRegion') ?? DEFAULT_WATCH_REGION,
  }
}

/**
 * The filter as TMDB /discover parameters.
 *
 * Media-type aware in three places, and all three are TMDB's rules rather than
 * ours: /discover/movie dates are `release_date.*` and /discover/tv dates are
 * `first_air_date.*`; runtime filters exist only for films; and TV discover has
 * no certification parameter at all.
 *
 * Anything sitting at its default is left out entirely — a parameter TMDB reads
 * as "no constraint" still widens the cache key it is sent with.
 */
export function toDiscoverParams(
  filter: MediaFilter,
  mediaType: 'movie' | 'tv'
): FilterParams {
  const params: FilterParams = { sort_by: filter.sortBy }

  if (filter.selectedGenres.length > 0) {
    params.with_genres = filter.selectedGenres.join(',')
  }
  if (filter.excludedGenres.length > 0) {
    params.without_genres = filter.excludedGenres.join(',')
  }

  if (filter.fromDate) {
    if (mediaType === 'movie') params['release_date.gte'] = filter.fromDate
    else params['first_air_date.gte'] = filter.fromDate
  }
  if (filter.toDate) {
    if (mediaType === 'movie') params['release_date.lte'] = filter.toDate
    else params['first_air_date.lte'] = filter.toDate
  }

  if (filter.minRating && filter.minRating > 0) {
    params['vote_average.gte'] = filter.minRating
  }
  if (filter.maxRating && filter.maxRating < 10) {
    params['vote_average.lte'] = filter.maxRating
  }
  if (filter.minVotes && filter.minVotes > 0) {
    params['vote_count.gte'] = filter.minVotes
  }

  if (mediaType === 'movie') {
    if (filter.minRuntime && filter.minRuntime > 0) {
      params.with_runtime_gte = filter.minRuntime
    }
    if (filter.maxRuntime && filter.maxRuntime < 300) {
      params.with_runtime_lte = filter.maxRuntime
    }
  }

  if (filter.originalLanguage) {
    params.with_original_language = filter.originalLanguage
  }

  if (mediaType === 'movie' && filter.certification) {
    params.certification = filter.certification
    params.certification_country = CERTIFICATION_COUNTRY
  }

  // `|` = OR (available on ANY picked provider); pairs with watch_region so the
  // ids resolve against the right regional catalog.
  if (filter.watchProviders.length > 0) {
    params.with_watch_providers = filter.watchProviders.join('|')
    params.watch_region = filter.watchRegion
  }

  return params
}

/**
 * A smart list's stored query, as the two things it takes to run it.
 *
 * `mediaType` rides in the query string because a smart list has no page to
 * infer it from — on the browse pages it comes from the path (/movies vs
 * /tv-shows), and a list is neither.
 */
export function smartQuery(query: string): {
  mediaType: 'movie' | 'tv'
  params: FilterParams
} {
  const mediaType = new URLSearchParams(
    query.startsWith('?') ? query.slice(1) : query
  ).get('mediaType')
  const type = mediaType === 'tv' ? 'tv' : 'movie'
  return {
    mediaType: type,
    params: toDiscoverParams(parseFilterQuery(query), type),
  }
}
