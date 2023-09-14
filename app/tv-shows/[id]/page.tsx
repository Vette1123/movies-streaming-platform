import React from 'react'
import { populateSeriesDetailsPageData } from '@/services/series'

import { SeriesDetailsContent } from '@/components/series/details-content'
import { SeriesDetailsHero } from '@/components/series/details-hero'

const TVSeries = async ({ params }: { params: { id: string } }) => {
  const { seriesDetails, seriesCredits, similarSeries, recommendedSeries } =
    await populateSeriesDetailsPageData(params?.id)

  return (
    <header className="relative">
      <SeriesDetailsHero series={seriesDetails} />
      <SeriesDetailsContent
        series={seriesDetails}
        seriesCredits={seriesCredits}
        similarSeries={similarSeries}
        recommendedSeries={recommendedSeries}
      />
    </header>
  )
}

export default TVSeries
