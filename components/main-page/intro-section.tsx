import React, { Suspense } from 'react'

import { MediaType } from '@/types/media'
import { Movie } from '@/types/movie-result'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'

interface MoviesIntroSectionProps {
  latestTrendingMovies: Movie[]
  allTimeTopRatedMovies: Movie[]
  popularMovies: Movie[]
  latestTrendingSeries: MediaType[]
  popularSeries: MediaType[]
  allTimeTopRatedSeries: MediaType[]
}

export const MoviesIntroSection = ({
  latestTrendingMovies,
  allTimeTopRatedMovies,
  popularMovies,
  latestTrendingSeries,
  popularSeries,
  allTimeTopRatedSeries,
}: MoviesIntroSectionProps) => {
  return (
    <section className="container max-w-screen-2xl">
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
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Trending Series"
          items={latestTrendingSeries}
          itemType="tv"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List title="Popular Series" items={popularSeries} itemType="tv" />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Top Rated Series"
          items={allTimeTopRatedSeries}
          itemType="tv"
        />
      </Suspense>
    </section>
  )
}
