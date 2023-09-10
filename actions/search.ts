'use server'

import { Param } from '@/types/movie-result'
import { MediaResponse } from '@/types/series-result'
import { fetchClient } from '@/lib/fetch-client'

export const searchMovieAction = (params: Param = {}) => {
  const url = `search/multi?include_adult=false&language=en-US&page=1`
  return fetchClient.get<MediaResponse>(url, params, true)
}
