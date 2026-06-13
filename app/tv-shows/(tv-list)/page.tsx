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

export const revalidate = 28800

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
  },
  twitter: {
    card: 'summary_large_image',
    title: TV_TITLE,
    description: TV_DESCRIPTION,
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
