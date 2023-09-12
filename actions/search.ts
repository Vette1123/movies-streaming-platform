'use server'

import { searchDTO } from '@/dtos/search'

import { Param } from '@/types/movie-result'
import { SearchResponse } from '@/types/search'
import { fetchClient } from '@/lib/fetch-client'

export const searchMovieAction = async (params: Param = {}) => {
  const url = `search/multi?include_adult=false&language=en-US&page=1`
  const rawData = await fetchClient.get<SearchResponse>(url, params, true)
  return searchDTO(rawData)
}
