import { cache } from 'react'
import { seriesDTO } from '@/dtos/series'

import { Param } from '@/types/movie-result'
import {
  MultiSeriesDetailsRequestProps,
  SeriesDetailsWithExtras,
} from '@/types/series-details'
import { SeriesResponse } from '@/types/series-result'
import { attachImdbRatings, getImdbRating } from '@/services/imdb'

import { fetchClient } from '@/lib/fetch-client'
import { tvType } from '@/lib/tmdbConfig'
import { pickTrailerKey } from '@/lib/videos'

const getLatestTrendingSeries = async (params: Param = {}) => {
  const url = `${tvType.trending}/tv/day?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(url, params, true)
  const dto = seriesDTO(rawData)
  return { ...dto, results: await attachImdbRatings(dto.results, 'tv') }
}

const getPopularSeries = async (params: Param = {}) => {
  'use server'
  const url = `tv/${tvType.popular}?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(url, params, true)
  const dto = seriesDTO(rawData)
  return { ...dto, results: await attachImdbRatings(dto.results, 'tv') }
}

const getAllTimeTopRatedSeries = async (params: Param = {}) => {
  const url = `tv/${tvType.top_rated}?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(url, params, true)
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
  const url = `tv/${id}?language=en-US&append_to_response=credits,similar,recommendations,videos,external_ids`
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

// Carousels are horizontal scrollers — 12 items is plenty and trims server-side
// render work vs. TMDB's full 20-item page.
const RELATED_LIMIT = 12

const populateSeriesDetailsPageData = async (
  id: string
): Promise<MultiSeriesDetailsRequestProps> => {
  try {
    const data = await getSeriesWithExtras(id)
    if (!data?.id) throw new Error('Series not found')
    return {
      seriesDetails: {
        ...data,
        imdbRating: await getImdbRating(data.external_ids?.imdb_id),
      },
      seriesCredits: data.credits ?? { id: data.id, cast: [], crew: [] },
      similarSeries: (data.similar
        ? seriesDTO(data.similar).results
        : []
      ).slice(0, RELATED_LIMIT),
      recommendedSeries: (data.recommendations
        ? seriesDTO(data.recommendations).results
        : []
      ).slice(0, RELATED_LIMIT),
      trailerKey: pickTrailerKey(data.videos?.results),
    }
  } catch (error: any) {
    console.error(error, 'error')
    throw new Error(error)
  }
}

export {
  getLatestTrendingSeries,
  getPopularSeries,
  getAllTimeTopRatedSeries,
  getSeriesDetailsById,
  populateSeriesDetailsPageData,
}
