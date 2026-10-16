import React from 'react'

import { SeriesDetails } from '@/types/series-details'
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
      overview={series.overview}
      genres={series.genres}
      mediaType="tv"
      extraInfo={seriesExtraInfoFormatter(series, director)}
    />
  )
}
