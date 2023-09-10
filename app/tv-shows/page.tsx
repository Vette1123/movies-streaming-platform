import React from 'react'
import { Metadata } from 'next'
import { getPopularSeries } from '@/services/series'

import { SeriesContent } from '@/components/media/series-content'

export const metadata: Metadata = {
  title: 'TV Shows',
  description: 'TV Shows List',
}

async function TvShows() {
  const series = await getPopularSeries()
  return (
    <section className="container h-full py-20 lg:py-36">
      <SeriesContent media={series} getPopularMediaAction={getPopularSeries} />
    </section>
  )
}

export default TvShows
