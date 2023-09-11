import { seriesDTO } from '@/dtos/series'

import { Param } from '@/types/movie-result'
import { MediaResponse, SeriesResponse } from '@/types/series-result'
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

export { getLatestTrendingSeries, getPopularSeries, getAllTimeTopRatedSeries }
