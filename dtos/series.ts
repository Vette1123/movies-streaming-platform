import { MediaResponse } from '@/types/media'
import { SeriesResponse } from '@/types/series-result'
import { capListOverviews } from '@/lib/media'

export const seriesDTO = (seriesResponse: SeriesResponse): MediaResponse => ({
  page: seriesResponse.page,
  // Every series list goes through this DTO, so the overview cap belongs here —
  // one place instead of once per list function.
  results: capListOverviews(
    seriesResponse.results.map((series) => {
      const { name, original_name, first_air_date, ...rest } = series
      return {
        ...rest,
        title: name,
        original_title: original_name,
        release_date: first_air_date,
        video: false,
      }
    })
  ),
  total_pages: seriesResponse?.total_pages,
  total_results: seriesResponse?.total_results,
})
