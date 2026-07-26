'use client'

import React, { Suspense } from 'react'

import { SeriesDetails } from '@/types/series-details'
import {
  buildMediaEventBase,
  trackMediaDetailViewed,
  trackMediaPlayed,
} from '@/lib/analytics'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { useMounted } from '@/hooks/use-mounted'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { DetailsHero } from '@/components/details-hero'

interface DeepLink {
  season: number
  episode: number
}

// Reads ?season/?episode during render, so it lives behind its own <Suspense>
// and renders nothing. Without that boundary, useSearchParams under a static
// prerender bails the whole route to client-side rendering — the detail pages
// then shipped as a bare skeleton with no <h1> and no crawlable text.
const SeriesDeepLinkReader = ({
  onResolve,
}: {
  onResolve: (season: number, episode: number) => void
}) => {
  const { seasonQueryINT, episodeQueryINT } = useSearchQueryParams()

  React.useEffect(() => {
    onResolve(seasonQueryINT, episodeQueryINT)
  }, [seasonQueryINT, episodeQueryINT, onResolve])

  return null
}

const seriesStreamUrl = (seriesId?: number, deepLink?: DeepLink | null) => {
  const base = `${STREAMING_MOVIES_API_URL}/tv/${seriesId}`
  return deepLink ? `${base}/${deepLink.season}/${deepLink.episode}` : base
}

export const SeriesDetailsHero = ({
  series,
  trailerKey,
}: {
  series: SeriesDetails
  trailerKey?: string
}) => {
  const [isIframeShown, setIsIframeShown] = React.useState(false)
  const [deepLink, setDeepLink] = React.useState<DeepLink | null>(null)
  const isMounted = useMounted()
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  // Stable identity, and a no-op when the values are unchanged, so the reader's
  // effect can't drive a setState → re-render loop.
  const handleDeepLink = React.useCallback(
    (season: number, episode: number) => {
      setDeepLink((prev) => {
        if (!season || !episode) return prev === null ? prev : null
        if (prev?.season === season && prev?.episode === episode) return prev
        return { season, episode }
      })
    },
    []
  )

  React.useEffect(() => {
    if (!series?.id) return
    trackMediaDetailViewed(buildMediaEventBase(series, 'tv'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series?.id])

  const playDefaultSeries = () => {
    if (!iframeRef.current) return
    setIsIframeShown(true)
    iframeRef.current.src = seriesStreamUrl(series?.id, deepLink)
  }

  React.useEffect(() => {
    if (!iframeRef.current || !deepLink || !isMounted) return
    setIsIframeShown(true)
    iframeRef.current.src = seriesStreamUrl(series?.id, deepLink)
    // Playback started via deep-link or episode selection (the manual
    // PlayButton path is tracked separately in PlayButton). Without this,
    // every episode play would be missing from media_played.
    trackMediaPlayed({
      ...buildMediaEventBase(series, 'tv'),
      season: deepLink.season,
      episode: deepLink.episode,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink, isMounted, series?.id])

  return (
    <>
      <Suspense fallback={null}>
        <SeriesDeepLinkReader onResolve={handleDeepLink} />
      </Suspense>
      <DetailsHero
        series={series}
        isIframeShown={isIframeShown}
        playVideo={playDefaultSeries}
        trailerKey={trailerKey}
        ref={iframeRef}
      />
    </>
  )
}
