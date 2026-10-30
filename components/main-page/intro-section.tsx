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
      {/* Every rail is a hydration island: SSR renders its posters (SEO/CLS
          intact), and List's per-card client machinery only hydrates once the
          page has loaded and the rail is near the viewport (see LazyRail /
          StaticRail). The two nearest the fold used to hydrate at once, and that
          was most of the page's blocking time. */}
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <LazyRail
          title="Trending Movies"
          items={latestTrendingMovies}
          itemType="movie"
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <LazyRail
          title="Popular Movies"
          items={popularMovies}
          itemType="movie"
        />
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
