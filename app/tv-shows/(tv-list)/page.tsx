import React from 'react'
import { Metadata } from 'next'
import { getPopularSeries } from '@/services/series'

import { siteConfig } from '@/config/site'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { MediaContent } from '@/components/media/media-content'

const generateOgImageUrl = (title: string, description: string) =>
  `${siteConfig.websiteURL}/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`

export const metadata: Metadata = {
  title: 'TV Shows',
  description: 'Discover and explore popular TV shows, trending series, and all-time favorites.',
  metadataBase: new URL('/tv-shows', process.env.NEXT_PUBLIC_BASE_URL),
  openGraph: {
    title: 'TV Shows - ' + siteConfig.name,
    description: 'Discover and explore popular TV shows, trending series, and all-time favorites.',
    url: '/tv-shows',
    images: [
      {
        url: generateOgImageUrl('TV Shows', 'Discover and explore popular TV shows'),
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
        alt: 'TV Shows - ' + siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TV Shows - ' + siteConfig.name,
    description: 'Discover and explore popular TV shows, trending series, and all-time favorites.',
    images: [generateOgImageUrl('TV Shows', 'Discover and explore popular TV shows')],
  },
}

async function TvShows() {
  const series = await getPopularSeries()
  return (
    <section className="container h-full py-20 lg:py-36">
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
