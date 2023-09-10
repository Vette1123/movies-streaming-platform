import React, { Suspense } from 'react'
import { populateHomePageData } from '@/services/movies'

import { HeroSlider } from '@/components/header/hero-slider'
import { FullScreenLoader } from '@/components/loaders/intro-pages-loader'
import { MoviesIntroSection } from '@/components/main-page/intro-section'

async function IndexPage() {
  const {
    nowPlayingMovies,
    latestTrendingMovies,
    allTimeTopRatedMovies,
    popularMovies,
    latestTrendingSeries,
    popularSeries,
    allTimeTopRatedSeries,
  } = await populateHomePageData()
  return (
    <section className="h-full">
      <Suspense fallback={<FullScreenLoader />}>
        <HeroSlider movies={nowPlayingMovies} />
      </Suspense>
      <MoviesIntroSection
        latestTrendingMovies={latestTrendingMovies}
        allTimeTopRatedMovies={allTimeTopRatedMovies}
        popularMovies={popularMovies}
        latestTrendingSeries={latestTrendingSeries}
        popularSeries={popularSeries}
        allTimeTopRatedSeries={allTimeTopRatedSeries}
      />
    </section>
  )
}
export default IndexPage
