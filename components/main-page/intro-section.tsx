import React, { Suspense } from 'react'

import { Movie } from '@/types/movie-result'
import { MediaType, Series } from '@/types/series-result'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'

interface MoviesIntroSectionProps {
  latestTrendingMovies: Movie[]
  allTimeTopRatedMovies: Movie[]
  popularMovies: Movie[]
  latestTrendingSeries: Series[]
  popularSeries: Series[]
  allTimeTopRatedSeries: Series[]
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
    <section className="container">
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Trending Movies"
          items={latestTrendingMovies as MediaType[]}
          itemType="movie"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Popular Movies"
          items={popularMovies as MediaType[]}
          itemType="movie"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Top Rated Movies"
          items={allTimeTopRatedMovies as MediaType[]}
          itemType="movie"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Trending Series"
          items={latestTrendingSeries as MediaType[]}
          itemType="tv"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Popular Series"
          items={popularSeries as MediaType[]}
          itemType="tv"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Top Rated Series"
          items={allTimeTopRatedSeries as MediaType[]}
          itemType="tv"
        />
      </Suspense>
    </section>
  )
}
