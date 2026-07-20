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

export const revalidate = 28800

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
    images: '/opengraph-image.png',
  },
  twitter: {
    title: `${siteConfig.name} — Discover & Track Movies and TV Shows`,
    description: HOME_DESCRIPTION,
    images: '/opengraph-image.png',
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
      {/* Single page-level h1 for SEO. Visually hidden (sr-only) so it doesn't
          disrupt the cinematic hero, but present in the DOM/SSR HTML — the hero
          slide titles are h2s, so the page had no h1 before. */}
      <h1 className="sr-only">
        {siteConfig.name} — Discover, track & stream movies and TV shows
      </h1>
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
      {/* Smooth handoff: the hero fades to near-black at its base, and this
          strip continues that dark and dissolves into the animated aurora over
          ~200px, so the background eases in under the first poster row instead
          of appearing as a hard seam. */}
      <div className="relative">
        <div className="from-background pointer-events-none absolute inset-x-0 top-0 z-[-1] h-52 bg-gradient-to-b to-transparent" />
        <MoviesIntroSection
          latestTrendingMovies={latestTrendingMovies}
          allTimeTopRatedMovies={allTimeTopRatedMovies}
          popularMovies={popularMovies}
          latestTrendingSeries={latestTrendingSeries}
          popularSeries={popularSeries}
          allTimeTopRatedSeries={allTimeTopRatedSeries}
        />
      </div>
    </section>
  )
}
export default IndexPage
