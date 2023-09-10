import { useInfiniteQuery } from '@tanstack/react-query'

import { PopularMediaAction } from '@/types/movie-result'
import { SeriesResponse } from '@/types/series-result'
import { QUERY_KEYS } from '@/lib/queryKeys'

interface Props {
  popularMediaAction: PopularMediaAction<SeriesResponse>
  media: SeriesResponse
}

export const useSeriesInfiniteScroll = ({
  media,
  popularMediaAction,
}: Props) => {
  const { data, fetchNextPage } = useInfiniteQuery({
    queryKey: [QUERY_KEYS.SERIES_KEY],
    queryFn: async ({ pageParam = 1 }) => {
      const data = await popularMediaAction({ page: pageParam })
      return data
    },
    getNextPageParam: (_, pages) => pages.length + 1,
    initialData: {
      pages: [media],
      pageParams: [1],
    },
  })

  return {
    data,
    fetchNextPage,
  }
}
