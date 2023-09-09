import React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { MovieResponse, PopularMovieAction } from '@/types/movie-result'
import { QUERY_KEYS } from '@/lib/queryKeys'

interface Props {
  popularMovieAction: PopularMovieAction
  movies: MovieResponse
}

export const useInfiniteScroll = ({ movies, popularMovieAction }: Props) => {
  const { data, fetchNextPage } = useInfiniteQuery({
    queryKey: [QUERY_KEYS.MOVIES_KEY],
    queryFn: async ({ pageParam = 1 }) => {
      const data = await popularMovieAction({ page: pageParam })
      console.log('data', data)
      return data
    },
    getNextPageParam: (_, pages) => pages.length + 1,
    initialData: {
      pages: [movies],
      pageParams: [1],
    },
  })

  return {
    data,
    fetchNextPage,
  }
}
