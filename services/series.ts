import { cache } from 'react'
import { seriesDTO } from '@/dtos/series'
import { attachImdbRatings, getImdbRating } from '@/services/imdb'

import { Param } from '@/types/movie-result'
import {
  MultiSeriesDetailsRequestProps,
  SeriesDetailsWithExtras,
} from '@/types/series-details'
import { SeriesResponse } from '@/types/series-result'
import { RAIL_LIMIT } from '@/lib/constants'
import { trimCredits } from '@/lib/credits'
import { fetchClient, isNotFoundError } from '@/lib/fetch-client'
import { detailAppend } from '@/lib/tmdb-append'
import { tvType } from '@/lib/tmdbConfig'
import { pickTrailer } from '@/lib/videos'

const getLatestTrendingSeries = async (params: Param = {}) => {
  const url = `${tvType.trending}/tv/day?language=en-US`
  // revalidate:false → build-only; consumed by the fully static homepage.
  const rawData = await fetchClient.get<SeriesResponse>(
    url,
    params,
    true,
    false
  )
  const dto = seriesDTO(rawData)
  return { ...dto, results: await attachImdbRatings(dto.results, 'tv') }
}

// No 'use server' here — see the same note in services/movies.ts.
const getPopularSeries = async (params: Param = {}) => {
  const url = `tv/${tvType.popular}?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(
    url,
    params,
    true,
    false
  )
  const dto = seriesDTO(rawData)
  return { ...dto, results: await attachImdbRatings(dto.results, 'tv') }
}

const getAllTimeTopRatedSeries = async (params: Param = {}) => {
  const url = `tv/${tvType.top_rated}?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(
    url,
    params,
    true,
    false
  )
  const dto = seriesDTO(rawData)
  return { ...dto, results: await attachImdbRatings(dto.results, 'tv') }
}

// Single TMDB request that returns details + credits + similar +
// recommendations via `append_to_response`, replacing four separate calls. On a
// cold on-demand render (long-tail id not prebuilt) that's ONE KV fetch-cache
// write and ONE JSON parse instead of four — the difference between staying
// under the free-plan 10ms Worker CPU / 1k KV-writes-per-day limits and blowing
// them (Error 1102 / "KV put() limit exceeded"). cache() dedupes it with
// generateMetadata so the whole page renders on a single fetch.
const getSeriesWithExtras = cache(async (id: string, params: Param = {}) => {
  // `videos` rides along on the same append_to_response — still ONE TMDB
  // request / one KV write — and powers the "Watch Trailer" CTA.
  const url = `tv/${id}?language=en-US&append_to_response=${detailAppend(['external_ids'])}`
  return fetchClient.get<SeriesDetailsWithExtras>(url, params, true)
})

// Kept for generateMetadata, which only needs the core fields. Delegates to the
// cached combined fetch so metadata + page share a single TMDB request.
const getSeriesDetailsById = cache(async (id: string, params: Param = {}) => {
  const series = await getSeriesWithExtras(id, params)
  return {
    ...series,
    imdbRating: await getImdbRating(series.external_ids?.imdb_id),
  }
})

const populateSeriesDetailsPageData = async (
  id: string
): Promise<MultiSeriesDetailsRequestProps> => {
  try {
    const data = await getSeriesWithExtras(id)
    if (!data?.id) throw new Error('Series not found')
    // Same peel as populateMovieDetailsPage — see the note there. `external_ids`
    // stays on seriesDetails: unlike the others it is not re-exposed in a
    // sibling field, and it is what imdbRating is derived from.
    const { credits, similar, recommendations, videos, ...details } = data
    const trailer = pickTrailer(videos?.results)
    return {
      seriesDetails: {
        ...details,
        imdbRating: await getImdbRating(data.external_ids?.imdb_id),
      },
      seriesCredits: trimCredits(credits, data.id),
      similarSeries: (similar ? seriesDTO(similar).results : []).slice(
        0,
        RAIL_LIMIT
      ),
      recommendedSeries: (recommendations
        ? seriesDTO(recommendations).results
        : []
      ).slice(0, RAIL_LIMIT),
      trailerKey: trailer?.key,
      trailerPublishedAt: trailer?.published_at,
    }
  } catch (error: any) {
    // Same as populateMovieDetailsPage — an unknown id is a normal answer, not a
    // fault, and the original error is rethrown so its status survives.
    if (!isNotFoundError(error)) console.error(error, 'error')
    throw error
  }
}

export {
  getLatestTrendingSeries,
  getPopularSeries,
  getAllTimeTopRatedSeries,
  getSeriesDetailsById,
  populateSeriesDetailsPageData,
}
