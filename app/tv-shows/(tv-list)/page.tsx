import React from 'react'
import { Metadata } from 'next'
import { getPopularSeries } from '@/services/series'

import { siteConfig } from '@/config/site'
import { QUERY_KEYS } from '@/lib/queryKeys'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { MediaContent } from '@/components/media/media-content'

// Fully static (see app/(landing)/page.tsx): built once per deploy, served from
// assets, never rendered on the Worker — so no free-plan subrequest/CPU caps.
// Filters + pagination are client-side (MediaContent), so nothing here is dynamic.
// getPopularSeries fetches with revalidate:false (services/series.ts), which is
// what makes the route build-only — revalidate=false alone would be floored to 8h
// by the fetch's own revalidate.
export const revalidate = false

const TV_TITLE = `TV Shows — Browse Popular, Trending & Top Rated`
const TV_DESCRIPTION =
  'Browse popular, trending, and top-rated TV shows. Track what you watch, discover new series, and never miss an episode on Reely.'
const TV_URL = `${siteConfig.websiteURL}/tv-shows`

export const metadata: Metadata = {
  title: 'TV Shows',
  description: TV_DESCRIPTION,
  keywords: [
    'popular tv shows',
    'trending series',
    'top rated tv',
    'new tv shows',
    'tv tracker',
    ...siteConfig.keywords,
  ],
  alternates: {
    canonical: '/tv-shows',
  },
  openGraph: {
    title: TV_TITLE,
    description: TV_DESCRIPTION,
    url: TV_URL,
    type: 'website',
    images: '/opengraph-image.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: TV_TITLE,
    description: TV_DESCRIPTION,
    images: '/opengraph-image.png',
  },
}

async function TvShows() {
  const series = await getPopularSeries()
  return (
    <section className="container h-full py-20 lg:py-36">
      <JsonLd
        data={collectionPageJsonLd({
          name: TV_TITLE,
          description: TV_DESCRIPTION,
          url: TV_URL,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'TV Shows', url: '/tv-shows' },
        ])}
      />
      <MediaContent
        media={series}
        getPopularMediaAction={getPopularSeries}
        queryKey={QUERY_KEYS.SERIES_KEY}
        enableFilters={true}
        filterLayout="sidebar"
        title="TV Shows"
      />
    </section>
  )
}

export default TvShows
