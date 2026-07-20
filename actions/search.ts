'use server'

import { searchDTO } from '@/dtos/search'

import { Param } from '@/types/movie-result'
import { SearchResponse } from '@/types/search'
import { getImdbRatingByTmdbId } from '@/services/imdb'

import { fetchClient } from '@/lib/fetch-client'

export const searchMovieAction = async (params: Param = {}) => {
  const url = `search/multi?include_adult=false&language=en-US&page=1`
  const rawData = await fetchClient.get<SearchResponse>(url, params, true)
  const dto = searchDTO(rawData)

  // Attach real IMDb scores per result (search/multi mixes movies + TV; people
  // have no rating). Governed + 30-day-id-cached, and soft-fails to the TMDB
  // average, so a slow lookup never blocks the picker's results.
  const results = await Promise.all(
    dto.results.map(async (item) => {
      const type = item.media_type
      if (type !== 'movie' && type !== 'tv') return item
      return { ...item, imdbRating: await getImdbRatingByTmdbId(item.id, type) }
    })
  )
  return { ...dto, results }
}
