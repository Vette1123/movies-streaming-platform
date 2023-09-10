import { Param } from '@/types/movie-result'
import { MediaResponse, SeriesResponse } from '@/types/series-result'
import { fetchClient } from '@/lib/fetch-client'
import { tvType } from '@/lib/tmdbConfig'

const getLatestTrendingSeries = async (params: Param = {}) => {
  const url = `${tvType.trending}/tv/day?language=en-US`
  return fetchClient.get<SeriesResponse>(url, params, true)
}

const getPopularSeries = async (params: Param = {}) => {
  'use server'
  const url = `tv/${tvType.popular}?language=en-US`
  return fetchClient.get<MediaResponse>(url, params, true)
}

const getAllTimeTopRatedSeries = async (params: Param = {}) => {
  const url = `tv/${tvType.top_rated}?language=en-US`
  return fetchClient.get<SeriesResponse>(url, params, true)
}

export { getLatestTrendingSeries, getPopularSeries, getAllTimeTopRatedSeries }
