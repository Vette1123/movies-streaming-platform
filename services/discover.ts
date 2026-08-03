import { attachImdbRatings } from '@/services/imdb'

import { FilterParams } from '@/types/filter'
import { MediaResponse } from '@/types/media'
import { Param } from '@/types/movie-result'
import { fetchClient } from '@/lib/fetch-client'
import { capListOverviews } from '@/lib/media'

// TMDB /discover, used from two runtimes and therefore deliberately free of
// both 'use server' and anything Next-specific:
//   - at build, by the static genre pages (server components);
//   - at runtime, by cloudflare/worker.js serving /api/filter for the browse
//     filters and genre infinite scroll.
// It used to live in actions/filter.ts as a Server Action, which a static
// export cannot contain. Keeping ONE implementation is the point — the filter
// results a crawler sees prerendered and the ones a user scrolls to must come
// from identical code.

// Drop undefined/null filters and coerce booleans to strings for the TMDB query
// string. Shared by both discover entry points so normalization can't diverge.
function normalizeFilterParams(
  filterParams: FilterParams
): Record<string, string | number> {
  const converted: Record<string, string | number> = {}
  Object.entries(filterParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      converted[key] = typeof value === 'boolean' ? value.toString() : value
    }
  })
  return converted
}

// TMDB /discover/movie uses `release_date.*`; /discover/tv uses `first_air_date.*`.
// The filter UI only speaks the movie keys, so remap them for TV.
function remapDateKey(
  params: Record<string, string | number>,
  from: string,
  to: string
) {
  if (params[from]) {
    params[to] = params[from]
    delete params[from]
  }
}

async function discover(
  mediaType: 'movie' | 'tv',
  filterParams: FilterParams,
  params: Param
): Promise<MediaResponse> {
  const converted = normalizeFilterParams(filterParams)
  if (mediaType === 'tv') {
    remapDateKey(converted, 'release_date.gte', 'first_air_date.gte')
    remapDateKey(converted, 'release_date.lte', 'first_air_date.lte')
  }

  const queryParams: Record<string, string | number> = {
    language: 'en-US',
    include_adult: 'false',
    // Movies filter out trailers/extras from /discover; TV has no such flag.
    ...(mediaType === 'movie' ? { include_video: 'false' } : {}),
    page: 1,
    ...converted,
    ...params,
  }

  // revalidate:false → build-only for the static genre pages. In the Worker the
  // `next` option is inert and caching is the Cache API layer in worker.js.
  const data = await fetchClient.get<MediaResponse>(
    `discover/${mediaType}`,
    queryParams,
    true,
    false
  )
  return {
    ...data,
    // Browse pages render the same cards as everywhere else, which slice the
    // overview at 400 — so don't ship more than that over the wire.
    results: capListOverviews(
      await attachImdbRatings(data.results || [], mediaType)
    ),
  }
}

export const discoverMovies = async (
  filterParams: FilterParams = {},
  params: Param = {}
): Promise<MediaResponse> => discover('movie', filterParams, params)

export const discoverSeries = async (
  filterParams: FilterParams = {},
  params: Param = {}
): Promise<MediaResponse> => discover('tv', filterParams, params)
