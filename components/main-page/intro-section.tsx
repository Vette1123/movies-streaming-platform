import React, { Suspense } from 'react'

import { Movie } from '@/types/movie-result'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'

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
    <section className="container">
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Trending Movies"
          items={latestTrendingMovies}
          itemType="movie"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List title="Popular Movies" items={popularMovies} itemType="movie" />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Top Rated Movies"
          items={allTimeTopRatedMovies}
          itemType="movie"
        />
      </Suspense>
    </section>
  )
}
