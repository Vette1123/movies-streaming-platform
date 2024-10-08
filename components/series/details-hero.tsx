'use client'

import React from 'react'

import { SeriesDetails } from '@/types/series-details'
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
