import { useInfiniteQuery } from '@tanstack/react-query'

import { MediaResponse } from '@/types/media'
import { MovieResponse, PopularMediaAction } from '@/types/movie-result'
import { QUERY_KEYS } from '@/lib/queryKeys'

interface Props {
  popularMediaAction: PopularMediaAction<MediaResponse>
  media: MovieResponse
  queryKey: typeof QUERY_KEYS.SERIES_KEY | typeof QUERY_KEYS.MOVIES_KEY
}

export const useInfiniteScroll = ({
  media,
  popularMediaAction,
  queryKey,
}: Props) => {
  const { data, fetchNextPage } = useInfiniteQuery({
    queryKey: [queryKey],
    initialPageParam: 0,
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
