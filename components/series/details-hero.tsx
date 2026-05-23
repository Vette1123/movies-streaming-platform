'use client'

import React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { useMounted } from '@/hooks/use-mounted'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { DetailsHero } from '@/components/details-hero'

export const SeriesDetailsHero = ({ series }: { series: SeriesDetails }) => {
  const { episodeQueryINT, seasonQueryINT } = useSearchQueryParams()
  const [isVideoShown, setIsVideoShown] = React.useState(false)
  const [videoUrl, setVideoUrl] = React.useState<string | undefined>()
  const isMounted = useMounted()

  // Mock video URL for testing since we don't have a real m3u8 API
  const mockVideoUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

  const playDefaultSeries = () => {
    if (!episodeQueryINT && !seasonQueryINT) {
      setIsVideoShown(true)
      setVideoUrl(mockVideoUrl)
    }
    if (episodeQueryINT && seasonQueryINT) {
      setIsVideoShown(true)
      setVideoUrl(mockVideoUrl)
    }
  }

  React.useEffect(() => {
    if (episodeQueryINT && seasonQueryINT && isMounted) {
      setIsVideoShown(true)
      setVideoUrl(mockVideoUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeQueryINT, seasonQueryINT, series?.id, isMounted])

  return (
    <DetailsHero
      series={series}
      isVideoShown={isVideoShown}
      playVideo={playDefaultSeries}
      videoUrl={videoUrl}
    />
  )
}
