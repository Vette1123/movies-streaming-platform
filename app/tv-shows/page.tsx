import React from 'react'
import { Metadata } from 'next'
import { getPopularSeries } from '@/services/series'

import { QUERY_KEYS } from '@/lib/queryKeys'
import { MediaContent } from '@/components/media/media-content'

export const metadata: Metadata = {
  title: 'TV Shows',
  description: 'TV Shows List',
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
