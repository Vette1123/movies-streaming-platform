'use server'

import { MovieResponse, Param } from '@/types/movie-result'
import { fetchClient } from '@/lib/fetch-client'

export const searchMovieAction = (params: Param = {}) => {
  const url = `search/movie?include_adult=false&language=en-US`
  return fetchClient.get<MovieResponse>(url, params, true)
}
