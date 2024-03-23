import React from 'react'
import { Metadata } from 'next'
import { getPopularSeries } from '@/services/series'

import { siteConfig } from '@/config/site'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { MediaContent } from '@/components/media/media-content'

export const metadata: Metadata = {
  title: 'TV Shows',
  description: 'TV Shows List',
  metadataBase: new URL('/movies', process.env.NEXT_PUBLIC_BASE_URL),
  openGraph: {
    images: [siteConfig.personalLogo, siteConfig.links.twitter],
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
      />
    </section>
  )
}

export default TvShows
