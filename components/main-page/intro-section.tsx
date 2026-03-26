import React, { Suspense } from 'react'

import { MediaType } from '@/types/media'
import { Movie } from '@/types/movie-result'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { Top10List } from '@/components/top10-list'
import { BecauseYouWatched } from '@/components/main-page/because-you-watched'
import { ContinueWatching } from '@/components/main-page/continue-watching'

interface MoviesIntroSectionProps {
  latestTrendingMovies: Movie[]
  allTimeTopRatedMovies: Movie[]
  popularMovies: Movie[]
  latestTrendingSeries: MediaType[]
  popularSeries: MediaType[]
  allTimeTopRatedSeries: MediaType[]
  nowPlayingMovies: Movie[]
  upcomingMovies: Movie[]
}

export const MoviesIntroSection = ({
  latestTrendingMovies,
  allTimeTopRatedMovies,
  popularMovies,
  latestTrendingSeries,
  popularSeries,
  allTimeTopRatedSeries,
  nowPlayingMovies,
  upcomingMovies,
}: MoviesIntroSectionProps) => {
  return (
    <section className="container max-w-(--breakpoint-2xl)">
      <ContinueWatching />
      <BecauseYouWatched />
      {nowPlayingMovies.length > 0 && (
        <Suspense fallback={<SliderHorizontalListLoader />}>
          <List title="Now Playing" items={nowPlayingMovies} itemType="movie" />
        </Suspense>
      )}
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Trending Movies"
          items={latestTrendingMovies}
          itemType="movie"
        />
      </Suspense>
      <Top10List
        title="Top 10 Movies Today"
        items={allTimeTopRatedMovies}
        itemType="movie"
      />
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List title="Popular Movies" items={popularMovies} itemType="movie" />
      </Suspense>
      {upcomingMovies.length > 0 && (
        <Suspense fallback={<SliderHorizontalListLoader />}>
          <List title="Coming Soon" items={upcomingMovies} itemType="movie" />
        </Suspense>
      )}
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Trending Series"
          items={latestTrendingSeries}
          itemType="tv"
        />
      </Suspense>
      <Top10List
        title="Top 10 Series Today"
        items={allTimeTopRatedSeries}
        itemType="tv"
      />
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List title="Popular Series" items={popularSeries} itemType="tv" />
      </Suspense>
    </section>
  )
}
