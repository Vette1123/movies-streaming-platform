import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { populateHomePageData } from '@/services/movies'

import { siteConfig } from '@/config/site'
import { HeroSlider } from '@/components/header/hero-slider'
import { FullScreenLoader } from '@/components/loaders/intro-pages-loader'
import { MoviesIntroSection } from '@/components/main-page/intro-section'

const generateOgImageUrl = (title: string, description: string) =>
  `${siteConfig.websiteURL}/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.websiteURL,
    images: [
      {
        url: generateOgImageUrl(siteConfig.name, siteConfig.description),
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
        alt: siteConfig.openGraph.images.default.alt,
        type: siteConfig.openGraph.images.default.type,
      },
      {
        url: siteConfig.image,
        width: siteConfig.openGraph.images.fallback.width,
        height: siteConfig.openGraph.images.fallback.height,
        alt: siteConfig.name,
        type: siteConfig.openGraph.images.fallback.type,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: generateOgImageUrl(siteConfig.name, siteConfig.description),
        alt: siteConfig.openGraph.images.default.alt,
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
      },
    ],
  },
}

async function IndexPage() {
  const {
    trendingMediaForHero,
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
        <HeroSlider movies={trendingMediaForHero} />
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
