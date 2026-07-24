import React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { DetailsExtraInfoLayout } from '@/components/media/details-extra-info-layout'
import { seriesExtraInfoFormatter } from '@/components/media/extra-info'

interface SeriesDetailsExtraInfoProps {
  series: SeriesDetails
  director: string | undefined
}

export const SeriesDetailsExtraInfo = ({
  series,
  director,
}: SeriesDetailsExtraInfoProps) => {
  return (
    <DetailsExtraInfoLayout
      title={series.name}
      badgeDate={series.first_air_date}
      tagline={series.tagline}
      overview={series.overview}
      genres={series.genres}
      mediaType="tv"
      heroRates={<HeroRatesInfos seriesDetails={series} />}
      extraInfo={seriesExtraInfoFormatter(series, director)}
    />
  )
}
