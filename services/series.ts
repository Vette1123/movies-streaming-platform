import { seriesDTO } from '@/dtos/series'

import { Credit } from '@/types/credit'
import { Param } from '@/types/movie-result'
import {
  MultiSeriesDetailsRequestProps,
  SeriesDetails,
} from '@/types/series-details'
import { SeriesResponse } from '@/types/series-result'
import { fetchClient } from '@/lib/fetch-client'
import { tvType } from '@/lib/tmdbConfig'

const getLatestTrendingSeries = async (params: Param = {}) => {
  const url = `${tvType.trending}/tv/day?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(url, params, true)
  return seriesDTO(rawData)
}

const getPopularSeries = async (params: Param = {}) => {
  'use server'
  const url = `tv/${tvType.popular}?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(url, params, true)
  return seriesDTO(rawData)
}

const getAllTimeTopRatedSeries = async (params: Param = {}) => {
  const url = `tv/${tvType.top_rated}?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(url, params, true)
  return seriesDTO(rawData)
}

const getSeriesDetailsById = async (id: string, params: Param = {}) => {
  const url = `tv/${id}?language=en-US`
  return fetchClient.get<SeriesDetails>(url, params, true)
}

const getSeriesCreditsById = async (id: string, params: Param = {}) => {
  const url = `tv/${id}/credits?language=en-US`
  return fetchClient.get<Credit>(url, params, true)
}

const getSimilarSeriesById = async (id: string, params: Param = {}) => {
  const url = `tv/${id}/similar?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(url, params, true)
  return seriesDTO(rawData)
}

const getRecommendedSeriesById = async (id: string, params: Param = {}) => {
  const url = `tv/${id}/recommendations?language=en-US`
  const rawData = await fetchClient.get<SeriesResponse>(url, params, true)
  return seriesDTO(rawData)
}

const populateSeriesDetailsPageData = async (
  id: string
): Promise<MultiSeriesDetailsRequestProps> => {
  try {
    const [seriesDetails, seriesCredits, similarSeries, recommendedSeries] =
      await Promise.all([
        getSeriesDetailsById(id),
        getSeriesCreditsById(id),
        getSimilarSeriesById(id),
        getRecommendedSeriesById(id),
      ])
    return {
      seriesDetails,
      seriesCredits,
      similarSeries: similarSeries?.results || [],
      recommendedSeries: recommendedSeries?.results || [],
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
  getSeriesCreditsById,
  populateSeriesDetailsPageData,
}
