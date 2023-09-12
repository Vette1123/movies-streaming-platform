import { MediaResponse } from '@/types/media'
import { SeriesResponse } from '@/types/series-result'

export const seriesDTO = (seriesResponse: SeriesResponse): MediaResponse => ({
  page: seriesResponse.page,
  results: seriesResponse.results.map((series) => {
    const { name, original_name, first_air_date, ...rest } = series
    return {
      ...rest,
      title: name,
      original_title: original_name,
      release_date: first_air_date,
      video: false,
    }
  }),
})
