'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'

import { SeriesDetails } from '@/types/series-details'
import { seriesStreamUrl } from '@/config/sources'
import {
  buildMediaEventBase,
  trackMediaDetailViewed,
  trackMediaPlayed,
} from '@/lib/analytics'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { useSeasonEpisodes } from '@/hooks/use-season-episodes'
import { useSeriesProgress } from '@/hooks/use-series-progress'
import { useStreamSource } from '@/hooks/use-stream-source'
import { DetailsHero } from '@/components/details-hero'
import { ContinueWatching } from '@/components/series/continue-watching'
import { useSeriesPlayback } from '@/components/series/playback-context'

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

const playbackKey = (target: DeepLink | null) =>
  target ? `${target.season}:${target.episode}` : 'default'

export const SeriesDetailsHero = ({
  series,
  trailerKey,
}: {
  series: SeriesDetails
  trailerKey?: string
}) => {
  // WHAT is playing, not the URL it produced. The URL is derived below, so
  // switching server re-points the frame at the same episode instead of needing
  // a second piece of state that could disagree with the chosen source.
  // `undefined` means nothing has been started; `null` means the series root.
  const [playingTarget, setPlayingTarget] = React.useState<
    DeepLink | null | undefined
  >(undefined)
  const [deepLink, setDeepLink] = React.useState<DeepLink | null>(null)
  const sourceControl = useStreamSource(`series:${series?.id}`)
  const { registerPlayer, reportPlaying } = useSeriesPlayback()
  // Which episode we have already counted as played (see startPlayback).
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
  // What the hero play button will start: the episode named by the URL if the
  // visitor arrived on one, else continue-watching, else the series default.
  const playTarget = deepLink ?? resumeTarget

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

  // Single entry point for starting the embed. Pressing play in the hero and
  // clicking the same episode in the list resolve to the SAME target, and
  // restarting playback from zero on the second one would be wrong — but that
  // is now handled by React: setSrc with an unchanged string re-renders nothing,
  // so the iframe is never re-pointed at the URL it already has.
  //
  // playedKeyRef survives only to dedupe the media_played EVENT, which is all it
  // was ever really about. It no longer gates the src write, so it can't leave
  // the embed unstarted, and there is no ref to be null: setting the src is
  // unconditional, so pressing play always does something.
  const startPlayback = React.useCallback(
    (target: DeepLink | null, options?: { track?: boolean }) => {
      reportPlaying(target)
      setPlayingTarget(target)
      const key = playbackKey(target)
      if (playedKeyRef.current === key) return
      playedKeyRef.current = key
      if (target && options?.track) {
        trackMediaPlayed({
          ...buildMediaEventBase(series, 'tv'),
          season: target.season,
          episode: target.episode,
        })
      }
    },
    [reportPlaying, series]
  )

  const playDefaultSeries = () => {
    // A URL deep-link always wins; otherwise fall back to continue-watching.
    const target = playTarget
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

  // Arriving at ?season/?episode deliberately does NOT start the stream — it
  // lands on the hero with that episode preselected (see playTarget) and lets
  // the visitor press play. Playback is only ever started by an explicit click,
  // here or in the episode list, which reaches the embed through this handler.
  React.useEffect(
    () => registerPlayer((target) => startPlayback(target, { track: true })),
    [registerPlayer, startPlayback]
  )

  const src =
    playingTarget === undefined || !series?.id
      ? ''
      : // A "series root" play normalizes to the first episode. Providers used
        // to pick one themselves off /tv/{id}, but a URL that names the episode
        // works on every provider on the list and cannot be second-guessed.
        seriesStreamUrl(
          sourceControl.source,
          series.id,
          playingTarget ?? { season: 1, episode: 1 }
        )

  return (
    <>
      <Suspense fallback={null}>
        <SeriesDeepLinkReader onResolve={handleDeepLink} />
      </Suspense>
      <DetailsHero
        series={series}
        src={src}
        sourceControl={sourceControl}
        playVideo={playDefaultSeries}
        trailerKey={trailerKey}
        playTarget={playTarget}
        isResume={Boolean(resumeTarget)}
        selfHost={
          playingTarget === undefined || !series?.id
            ? undefined
            : {
                type: 'tv',
                id: series.id,
                season: playingTarget?.season ?? 1,
                episode: playingTarget?.episode ?? 1,
                title: series.name,
                year: Number(series.first_air_date?.slice(0, 4)) || undefined,
                imdb: series.external_ids?.imdb_id || undefined,
              }
        }
        resumeSlot={
          <ContinueWatching
            progress={progress}
            episodeName={resumeEpisodeName}
          />
        }
      />
    </>
  )
}
