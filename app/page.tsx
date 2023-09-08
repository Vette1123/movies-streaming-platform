import React, { Suspense } from 'react'
import { populateHomePageData } from '@/services/movies'

import { HeroSlider } from '@/components/header/hero-slider'
import { MoviesIntroSection } from '@/components/main-page/intro-section'

async function IndexPage() {
  const {
    nowPlayingMovies,
    latestTrendingMovies,
    allTimeTopRatedMovies,
    popularMovies,
  } = await populateHomePageData()
  return (
    <section className="h-full">
      <Suspense
        fallback={<div className="h-screen bg-red-800">Loading...</div>}
      >
        <HeroSlider movies={nowPlayingMovies} />
      </Suspense>
      <MoviesIntroSection
        latestTrendingMovies={latestTrendingMovies}
        allTimeTopRatedMovies={allTimeTopRatedMovies}
        popularMovies={popularMovies}
      />
    </section>
  )
}
export default IndexPage
