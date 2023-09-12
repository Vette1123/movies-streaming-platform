import { MediaResponse } from '@/types/media'
import { SearchResponse } from '@/types/search'

export const searchDTO = (searchResponse: SearchResponse): MediaResponse => ({
  page: searchResponse.page,
  results: searchResponse.results.map((search) => {
    const {
      name,
      original_name,
      first_air_date,
      title,
      original_title,
      release_date,
      ...rest
    } = search

    if (search.media_type === 'tv') {
      return {
        ...rest,
        title: name,
        original_title: original_name,
        release_date: first_air_date,
      }
    }
    return {
      ...rest,
      title,
      original_title,
      release_date,
    }
  }),
})
