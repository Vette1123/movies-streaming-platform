import React, { Suspense } from 'react'

import { Movie } from '@/types/movie-result'
import { List } from '@/components/list'

interface MoviesIntroSectionProps {
  latestTrendingMovies: Movie[]
  allTimeTopRatedMovies: Movie[]
  popularMovies: Movie[]
}

export const MoviesIntroSection = ({
  latestTrendingMovies,
  allTimeTopRatedMovies,
  popularMovies,
}: MoviesIntroSectionProps) => {
  return (
    <section>
      <Suspense fallback={<div>Loading...</div>}>
        <List
          title="Trending Movies"
          items={latestTrendingMovies}
          itemType="movie"
        />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <List title="Popular Movies" items={popularMovies} itemType="movie" />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <List
          title="Top Rated Movies"
          items={allTimeTopRatedMovies}
          itemType="movie"
        />
      </Suspense>
    </section>
  )
}
