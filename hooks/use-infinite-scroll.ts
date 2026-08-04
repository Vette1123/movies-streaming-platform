import { useInfiniteQuery } from '@tanstack/react-query'

import { MovieResponse } from '@/types/movie-result'
import { getPopularApi } from '@/lib/api-client'
import { QUERY_KEYS } from '@/lib/queryKeys'

interface Props {
  media: MovieResponse
  queryKey: typeof QUERY_KEYS.SERIES_KEY | typeof QUERY_KEYS.MOVIES_KEY
}

// Page 1 arrives prerendered as `media`; every page after it comes from the
// Worker's /api/popular.
//
// This used to receive the fetcher itself as a prop — a Server Action handed
// from a server page into a client component. A static export cannot do that:
// functions are not serializable across the boundary and the build fails
// outright ("Functions cannot be passed directly to Client Components"). The
// media type is derived from the query key instead, and the endpoint resolved
// on the client.
export const useInfiniteScroll = ({ media, queryKey }: Props) => {
  const mediaType = queryKey === QUERY_KEYS.MOVIES_KEY ? 'movie' : 'tv'

  const { data, fetchNextPage, isFetchingNextPage, hasNextPage, isError } =
    useInfiniteQuery({
      queryKey: [queryKey],
      initialPageParam: 0,
      queryFn: ({ pageParam = 1 }) =>
        getPopularApi(mediaType, Number(pageParam)),
      getNextPageParam: (_, pages) => pages.length + 1,
      initialData: {
        pages: [media],
        pageParams: [1],
      },
    })

  return {
    data,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
    isError,
  }
}
