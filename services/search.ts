import { searchDTO } from '@/dtos/search'
import { getImdbRatingByTmdbId } from '@/services/imdb'

import { Param } from '@/types/movie-result'
import { SearchResponse } from '@/types/search'
import { fetchClient } from '@/lib/fetch-client'

// Multi-search, moved out of actions/search.ts (a Server Action, which a static
// export cannot contain) so cloudflare/worker.js can serve it as /api/search.
export const searchMedia = async (params: Param = {}) => {
  const url = `search/multi?include_adult=false&language=en-US&page=1`
  const rawData = await fetchClient.get<SearchResponse>(url, params, true)
  const dto = searchDTO(rawData)

  // Attach real IMDb scores per result (search/multi mixes movies + TV; people
  // have no rating). A no-op while NEXT_PUBLIC_IMDB_RATINGS is off, and soft-
  // fails to the TMDB average, so a slow lookup never blocks the picker.
  const results = await Promise.all(
    dto.results.map(async (item) => {
      const type = item.media_type
      if (type !== 'movie' && type !== 'tv') return item
      return { ...item, imdbRating: await getImdbRatingByTmdbId(item.id, type) }
    })
  )
  return { ...dto, results }
}
