import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { populateHomePageData } from '@/services/movies'

import { siteConfig } from '@/config/site'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  JsonLd,
  webApplicationJsonLd,
} from '@/lib/structured-data'
import { HeroSlider } from '@/components/header/hero-slider'
import { FullScreenLoader } from '@/components/loaders/intro-pages-loader'
import { MoviesIntroSection } from '@/components/main-page/intro-section'
import { SectionErrorBoundary } from '@/components/section-error-boundary'

// Fully static: rendered ONLY at build, served from static assets, never on the
// Worker. Freshness comes from the 4x/day CI redeploy — not on-demand ISR. This
// is deliberate: an on-demand render fans out enough TMDB subrequests to trip the
// Cloudflare free-plan 50-subrequests/invocation cap (and the 10ms CPU ceiling),
// which is what 500'd / 1102'd this page. Static build has no such caps.
//
// revalidate=false here is NOT enough on its own: Next takes the MIN of the
// segment revalidate and every fetch's revalidate, and fetchClient defaults to
// next.revalidate=28800 — which would floor the route back onto an 8h ISR timer.
// The actual lever is that populateHomePageData's fetches pass revalidate:false
// (see services/movies.ts, services/series.ts) → every fetch is ∞ → the route is
// genuinely build-only. (force-static does NOT override an explicit fetch
// revalidate, so it wouldn't have helped — the fetch-level change is what counts.)
export const revalidate = false

const HOME_DESCRIPTION =
  'Discover trending movies and TV shows, track what you watch, and never miss a release. Reely brings the latest, top-rated, and popular titles into one seamless experience.'

export const metadata: Metadata = {
  // Absolute, so the root template does not append "| Reely" to a title that
  // already opens with it. The old value rendered as
  // "Reely — Discover & Track Movies and TV Shows | Reely": harmless to a
  // person, two different names to anything matching the consent screen's app
  // name against this page.
  title: {
    absolute: `${siteConfig.name} — Discover & Track Movies and TV Shows`,
  },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    // `siteName` is repeated from the root layout because Next REPLACES the
    // parent `openGraph` object rather than merging into it — declaring one here
    // dropped `og:site_name` from the homepage, and that tag is one of the few
    // machine-readable places an automated reviewer looks for the app's name.
    siteName: siteConfig.openGraph.siteName,
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
          slide titles are h2s, so the page had no h1 before. The visible
          statement of what this site is lives in the footer, on every page.
          A visible version of this line rode over the hero for one deploy, to
          answer Google's OAuth branding review; the review failed again with it
          in place, so it bought nothing and cost the hero its clean first
          screen. See lessons/2026-08-16-oauth-branding-review.md. */}
      <h1 className="sr-only">
        {siteConfig.name} — Discover, track &amp; stream movies and TV shows
      </h1>
      <JsonLd
        data={collectionPageJsonLd({
          name: `${siteConfig.name} — Home`,
          description: HOME_DESCRIPTION,
          url: siteConfig.websiteURL,
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: '/' }])} />
      <JsonLd data={webApplicationJsonLd} />
      {/* Hero and rails get their own boundaries: a failure in the carousel
          (or in one of its lazily-loaded chunks) used to blank the entire
          homepage, even though every poster row below had rendered fine. */}
      <SectionErrorBoundary section="home_hero" title="The hero didn't load">
        <Suspense fallback={<FullScreenLoader />}>
          <HeroSlider movies={trendingMediaForHero} />
        </Suspense>
      </SectionErrorBoundary>
      {/* Smooth handoff: the hero fades to near-black at its base, and this
          strip continues that dark and dissolves into the animated aurora over
          ~200px, so the background eases in under the first poster row instead
          of appearing as a hard seam. */}
      <div className="relative">
        <div className="from-background pointer-events-none absolute inset-x-0 top-0 z-[-1] h-52 bg-gradient-to-b to-transparent" />
        <SectionErrorBoundary
          section="home_rails"
          title="These rows didn't load"
        >
          <MoviesIntroSection
            latestTrendingMovies={latestTrendingMovies}
            allTimeTopRatedMovies={allTimeTopRatedMovies}
            popularMovies={popularMovies}
            latestTrendingSeries={latestTrendingSeries}
            popularSeries={popularSeries}
            allTimeTopRatedSeries={allTimeTopRatedSeries}
          />
        </SectionErrorBoundary>
      </div>
    </section>
  )
}
export default IndexPage
