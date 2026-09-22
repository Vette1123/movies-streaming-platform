import React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { DetailsExtraInfoLayout } from '@/components/media/details-extra-info-layout'
import { seriesExtraInfoFormatter } from '@/components/media/extra-info'

// TMDB's terminal series statuses.
const ENDED_STATUSES = new Set(['Ended', 'Canceled'])

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
      // An ended show can keep a stale future date on TMDB; no chip for it.
      nextAirDate={
        ENDED_STATUSES.has(series.status)
          ? null
          : series.next_episode_to_air?.air_date
      }
      tagline={series.tagline}
      overview={series.overview}
      genres={series.genres}
      mediaType="tv"
      heroRates={<HeroRatesInfos seriesDetails={series} />}
      extraInfo={seriesExtraInfoFormatter(series, director)}
    />
  )
}
