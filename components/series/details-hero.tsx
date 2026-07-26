'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'

import { SeriesDetails } from '@/types/series-details'
import {
  buildMediaEventBase,
  trackMediaDetailViewed,
  trackMediaPlayed,
} from '@/lib/analytics'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { useMounted } from '@/hooks/use-mounted'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { useSeasonEpisodes } from '@/hooks/use-season-episodes'
import { useSeriesProgress } from '@/hooks/use-series-progress'
import { DetailsHero } from '@/components/details-hero'
import { ContinueWatching } from '@/components/series/continue-watching'

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

const playbackKey = (target: DeepLink | null) =>
  target ? `${target.season}:${target.episode}` : 'default'

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
  // Which episode the embed is currently loaded with (see startPlayback).
  const playedKeyRef = React.useRef<string | null>(null)
  const router = useRouter()

  const progress = useSeriesProgress(series)
  const resume = progress.resume
  // Same query key the season navigator uses, so naming the resume episode
  // rides along on the season fetch the navigator makes anyway (see
  // use-season-episodes). Idle until there is something to resume.
  const { episodes: resumeSeasonEpisodes } = useSeasonEpisodes(
    series?.id,
    resume?.season
  )
  const resumeEpisodeName = React.useMemo(
    () =>
      resumeSeasonEpisodes?.find(
        (episode) => episode.episode_number === resume?.episode
      )?.name,
    [resumeSeasonEpisodes, resume?.episode]
  )
  const resumeTarget = React.useMemo(
    () => (resume ? { season: resume.season, episode: resume.episode } : null),
    [resume]
  )

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

  // Single entry point for starting the embed, keyed on the episode. A resume
  // click and the ?season/?episode effect resolve to the SAME episode (the click
  // pushes those params), so without this guard the iframe src would be rewritten
  // — restarting playback from zero — and media_played would fire twice.
  const startPlayback = React.useCallback(
    (target: DeepLink | null, options?: { track?: boolean }) => {
      if (!iframeRef.current) return
      setIsIframeShown(true)
      const key = playbackKey(target)
      if (playedKeyRef.current === key) return
      playedKeyRef.current = key
      iframeRef.current.src = seriesStreamUrl(series?.id, target)
      if (target && options?.track) {
        trackMediaPlayed({
          ...buildMediaEventBase(series, 'tv'),
          season: target.season,
          episode: target.episode,
        })
      }
    },
    [series]
  )

  const playDefaultSeries = () => {
    // A URL deep-link always wins; otherwise fall back to continue-watching.
    const target = deepLink ?? resumeTarget
    // PlayButton already fired media_played for this click (with is_resume).
    startPlayback(target)
    if (target && !deepLink) {
      // Mirror the resume into the URL so the episode list highlights what is
      // playing and the tab stays shareable. `replace`, not `push`: an implicit
      // resume shouldn't add a back-button step.
      router.replace(`?season=${target.season}&episode=${target.episode}`, {
        scroll: false,
      })
    }
  }

  React.useEffect(() => {
    if (!deepLink || !isMounted) return
    // Playback started via deep-link or episode selection (the manual
    // PlayButton path is tracked separately in PlayButton). Without this,
    // every episode play would be missing from media_played.
    startPlayback(deepLink, { track: true })
  }, [deepLink, isMounted, startPlayback])

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
        resume={resumeTarget}
        resumeSlot={
          <ContinueWatching
            progress={progress}
            episodeName={resumeEpisodeName}
          />
        }
        ref={iframeRef}
      />
    </>
  )
}
