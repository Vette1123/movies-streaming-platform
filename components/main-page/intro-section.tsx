import React, { Suspense } from 'react'

import { MediaType } from '@/types/media'
import { Movie } from '@/types/movie-result'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { LazyRail } from '@/components/main-page/lazy-rail'

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
    <section className="w-full">
      {/* The first two rails sit closest to the fold — render them eager (full
          interactive List) so the top of the page is never a static frame. The
          remaining four are below-fold hydration islands: SSR renders their
          posters (SEO/CLS intact), but List's per-card client machinery only
          hydrates as each rail nears the viewport (see LazyRail / StaticRail). */}
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
        <LazyRail
          title="Top Rated Movies"
          items={allTimeTopRatedMovies}
          itemType="movie"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <LazyRail
          title="Trending Series"
          items={latestTrendingSeries}
          itemType="tv"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <LazyRail title="Popular Series" items={popularSeries} itemType="tv" />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <LazyRail
          title="Top Rated Series"
          items={allTimeTopRatedSeries}
          itemType="tv"
        />
      </Suspense>
    </section>
  )
}
