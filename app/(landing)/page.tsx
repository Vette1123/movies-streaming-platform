import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { populateHomePageData } from '@/services/movies'

import { siteConfig } from '@/config/site'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { HeroSlider } from '@/components/header/hero-slider'
import { FullScreenLoader } from '@/components/loaders/intro-pages-loader'
import { MoviesIntroSection } from '@/components/main-page/intro-section'

const HOME_DESCRIPTION =
  'Discover trending movies and TV shows, track what you watch, and never miss a release. Reely brings the latest, top-rated, and popular titles into one seamless experience.'

export const metadata: Metadata = {
  title: `${siteConfig.name} — Discover & Track Movies and TV Shows`,
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${siteConfig.name} — Discover & Track Movies and TV Shows`,
    description: HOME_DESCRIPTION,
    url: siteConfig.websiteURL,
    type: 'website',
    images: [
      {
        url: '/opengraph-image.png',
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
        alt: siteConfig.openGraph.images.default.alt,
        type: siteConfig.openGraph.images.default.type,
      },
    ],
  },
  twitter: {
    title: `${siteConfig.name} — Discover & Track Movies and TV Shows`,
    description: HOME_DESCRIPTION,
    images: ['/opengraph-image.png'],
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
      <JsonLd
        data={collectionPageJsonLd({
          name: `${siteConfig.name} — Home`,
          description: HOME_DESCRIPTION,
          url: siteConfig.websiteURL,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([{ name: 'Home', url: '/' }])}
      />
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
