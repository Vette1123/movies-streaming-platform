'use client'

import React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'

import { MovieResponse, Param, PopularMovieAction } from '@/types/movie-result'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { Card } from '@/components/card'

interface MoviesContentProps {
  movies: MovieResponse
  getPopularMoviesAction: PopularMovieAction
}

export const MoviesContent = ({
  movies,
  getPopularMoviesAction,
}: MoviesContentProps) => {
  const [myRef, inView] = useInView()
  const { data, fetchNextPage } = useInfiniteScroll({
    movies,
    popularMovieAction: getPopularMoviesAction,
  })

  React.useEffect(() => {
    if (inView) {
      fetchNextPage()
    }
  }, [inView, fetchNextPage])

  if (!data) return <div className="text-muted-foreground">No data found</div>
  const { pages } = data

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
      {pages &&
        pages.map((page, index) => (
          <React.Fragment key={index}>
            {page &&
              page?.results?.map((movie) => (
                <Card key={movie.id} item={movie} isTruncateOverview={false} />
              ))}
          </React.Fragment>
        ))}
      <div ref={myRef} />
    </div>
  )
}
