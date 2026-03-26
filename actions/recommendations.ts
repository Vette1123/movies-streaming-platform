'use server'

import { seriesDTO } from '@/dtos/series'

import { MediaResponse } from '@/types/media'
import { MovieResponse } from '@/types/movie-result'
import { fetchClient } from '@/lib/fetch-client'

export const getRecommendationsAction = async ({
  id,
  type,
}: {
  id: number
  type: 'movie' | 'series'
}): Promise<MediaResponse> => {
  const mediaType = type === 'series' ? 'tv' : 'movie'
  const url = `${mediaType}/${id}/recommendations?language=en-US`
  if (type === 'series') {
    const rawData = await fetchClient.get<any>(url, {}, true)
    return seriesDTO(rawData)
  }
  const data = await fetchClient.get<MovieResponse>(url, {}, true)
  return data as unknown as MediaResponse
}
