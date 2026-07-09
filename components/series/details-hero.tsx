'use client'

import React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { trackMediaDetailViewed, trackMediaPlayed } from '@/lib/analytics'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { useMounted } from '@/hooks/use-mounted'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { DetailsHero } from '@/components/details-hero'

export const SeriesDetailsHero = ({ series }: { series: SeriesDetails }) => {
  const { episodeQueryINT, seasonQueryINT } = useSearchQueryParams()
  const [isIframeShown, setIsIframeShown] = React.useState(false)
  const isMounted = useMounted()
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  const autoplaySessionURL = `${STREAMING_MOVIES_API_URL}/tv/${series?.id}/${seasonQueryINT}/${episodeQueryINT}`

  React.useEffect(() => {
    if (!series?.id) return
    trackMediaDetailViewed({
      media_id: series.id,
      media_type: 'tv',
      title: series.name,
      vote_average: series.vote_average,
      release_year: series.first_air_date
        ? Number(series.first_air_date.slice(0, 4))
        : null,
      genres: series.genres?.map((g) => g.name),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series?.id])

  const playDefaultSeries = () => {
    if (iframeRef.current && !episodeQueryINT && !seasonQueryINT) {
      setIsIframeShown(true)
      iframeRef.current.src = `${STREAMING_MOVIES_API_URL}/tv/${series?.id}`
    }
    if (iframeRef.current && episodeQueryINT && seasonQueryINT) {
      setIsIframeShown(true)
      iframeRef.current.src = autoplaySessionURL
    }
  }

  React.useEffect(() => {
    if (iframeRef.current && episodeQueryINT && seasonQueryINT && isMounted) {
      setIsIframeShown(true)
      iframeRef.current.src = autoplaySessionURL
      // Playback started via deep-link or episode selection (the manual
      // PlayButton path is tracked separately in PlayButton). Without this,
      // every episode play would be missing from media_played.
      trackMediaPlayed({
        media_id: series.id,
        media_type: 'tv',
        title: series.name,
        season: seasonQueryINT,
        episode: episodeQueryINT,
        vote_average: series.vote_average,
        release_year: series.first_air_date
          ? Number(series.first_air_date.slice(0, 4))
          : null,
        genres: series.genres?.map((g) => g.name),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeQueryINT, seasonQueryINT, series?.id])

  return (
    <DetailsHero
      series={series}
      isIframeShown={isIframeShown}
      playVideo={playDefaultSeries}
      ref={iframeRef}
    />
  )
}
