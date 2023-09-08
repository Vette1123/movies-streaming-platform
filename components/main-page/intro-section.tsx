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
          href="/movies"
          items={latestTrendingMovies}
        />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <List title="Popular Movies" href="/movies" items={popularMovies} />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <List
          title="Top Rated Movies"
          href="/movies"
          items={allTimeTopRatedMovies}
        />
      </Suspense>
    </section>
  )
}
