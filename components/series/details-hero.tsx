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
import { isTitleBlocked } from '@/lib/blocked-titles'
import { notePlayForSupportNudge } from '@/lib/support-nudge'
import { useAccount } from '@/hooks/use-account'
import { useCompletedMedia } from '@/hooks/use-completed-media'
import { readFrameTokens, useFrameTokens } from '@/hooks/use-frame-tokens'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { useSeasonEpisodes } from '@/hooks/use-season-episodes'
import { useSeriesProgress } from '@/hooks/use-series-progress'
import { useStreamSource } from '@/hooks/use-stream-source'
import { useWatchedMedia } from '@/hooks/use-watched-media'
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

const sameEpisode = (a?: DeepLink | null, b?: DeepLink | null) =>
  !!a && !!b && a.season === b.season && a.episode === b.episode

/**
 * What the hero's play button starts: the episode the URL names, else
 * continue-watching. Except a link to an episode already FINISHED while there
 * is somewhere to go on to. That is nearly always this tab's own URL from the
 * last sitting (pressing play mirrors the episode into it), or a homepage tile
 * computed before the finish synced, and handing back the credits of what you
 * just watched is the "resume does not work" people reported.
 */
const pickPlayTarget = (
  deepLink: DeepLink | null,
  resumeTarget: DeepLink | null,
  deepLinkFinished: boolean
): DeepLink | null => {
  if (!deepLink) return resumeTarget
  if (deepLinkFinished && resumeTarget) return resumeTarget
  return deepLink
}

export const SeriesDetailsHero = ({
  series,
  trailerKey,
  logoPath,
}: {
  series: SeriesDetails
  trailerKey?: string
  logoPath?: string | null
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
  // Supporter-only in practice: nothing but the Reely Player reports an ending.
  const { prefs } = useAccount()
  const autoNext = prefs.autoNext === true
  const spoilerFree = prefs.spoilerFree === true
  // Which episode we have already counted as played (see startPlayback).
  const playedKeyRef = React.useRef<string | null>(null)
  const router = useRouter()
  const { isEpisodeCompleted, markEpisodesCompleted } = useCompletedMedia()
  const { handleWatchMedia } = useWatchedMedia()

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
  // What the hero play button will start (see pickPlayTarget), else the series
  // default.
  const playTarget = pickPlayTarget(
    deepLink,
    resumeTarget,
    !!deepLink &&
      !!series?.id &&
      isEpisodeCompleted(series.id, deepLink.season, deepLink.episode)
  )

  const isResume = sameEpisode(playTarget, resumeTarget)
  // The caption names the episode only when the button is aimed at it, and
  // not when that name is still ahead of the viewer with spoiler-free on — the
  // episode list masks the same title (see maskedName in episodes.tsx).
  const captionName =
    isResume && !(spoilerFree && resume?.isNext) ? resumeEpisodeName : undefined

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
        notePlayForSupportNudge()
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
    const target = playTarget
    // PlayButton already fired media_played for this click (with is_resume).
    startPlayback(target)
    if (target && !sameEpisode(target, deepLink)) {
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

  // Autoplay of the next episode, for accounts that asked for it.
  //
  // The only surface that can report an ending is the Reely Player: an embed is
  // a cross-origin iframe that tells the page nothing, which is why the rest of
  // this file infers progress rather than observing it. So this is a supporter
  // feature by construction, not by policy.
  //
  // The season's own episode count decides whether there IS a next one, and it
  // is on the payload the page already rendered from. Stopping at the end of a
  // season rather than rolling into the next is deliberate: the next season is
  // a different fetch, often a different release year, and "it kept playing"
  // is a worse surprise than "it stopped".
  const seasonCount = React.useMemo(() => {
    const season = playingTarget?.season
    if (!season) return 0
    return (
      series?.seasons?.find((entry) => entry.season_number === season)
        ?.episode_count ?? 0
    )
  }, [series?.seasons, playingTarget?.season])

  const handleEnded = React.useCallback(() => {
    if (!autoNext || !playingTarget) return
    const next = playingTarget.episode + 1
    if (next > seasonCount) return
    const target = { season: playingTarget.season, episode: next }
    // The bookmark moves with it. Only the play button and the episode list
    // used to write history, so a night of autoplay left "continue" on the
    // episode it started from.
    handleWatchMedia(series, target)
    startPlayback(target, { track: true })
    router.replace(`?season=${target.season}&episode=${target.episode}`, {
      scroll: false,
    })
  }, [
    autoNext,
    handleWatchMedia,
    playingTarget,
    router,
    seasonCount,
    series,
    startPlayback,
  ])

  // Watched to the credits: tick it off, so "continue" moves past it instead
  // of offering the same episode back from the top. Nothing did this before; an
  // episode only ever counted as finished once a LATER one was started from
  // the list.
  const handleFinished = React.useCallback(() => {
    if (!series?.id) return
    const target = playingTarget ?? { season: 1, episode: 1 }
    markEpisodesCompleted([
      {
        showId: series.id,
        season: target.season,
        episode: target.episode,
        seriesName: series.name,
        overview: '',
        backdrop_path: series.backdrop_path ?? '',
        poster_path: series.poster_path ?? '',
      },
    ])
  }, [markEpisodesCompleted, playingTarget, series])

  // Playback disabled following a copyright notice — see
  // config/blocked-titles.json. A show is blocked whole: a notice names the
  // work, and every episode of it is that work.
  const blocked = isTitleBlocked('tv', series?.id)

  // What the house player plays, and also what it warms a ticket for while the
  // thumb is still on its way to the button. It used to stay undefined until
  // play, so on a series page the ticket round trip was always paid after the
  // tap — the warm-up only ever worked on films.
  const hostTarget = (playingTarget === undefined
    ? playTarget
    : playingTarget) ?? {
    season: 1,
    episode: 1,
  }

  // A "series root" play normalizes to the first episode. Providers used to
  // pick one themselves off /tv/{id}, but a URL that names the episode works on
  // every provider on the list and cannot be second-guessed.
  const frameTarget = playingTarget ?? { season: 1, episode: 1 }
  const framing = !blocked && playingTarget !== undefined && !!series?.id
  const frameTokens = useFrameTokens(
    framing
      ? `${sourceControl.source.id}:${frameTarget.season}:${frameTarget.episode}`
      : null,
    () =>
      series?.id
        ? readFrameTokens(
            'tv',
            series.id,
            frameTarget.season,
            frameTarget.episode
          )
        : {}
  )
  const src = framing
    ? seriesStreamUrl(sourceControl.source, series.id, frameTarget, frameTokens)
    : ''

  return (
    <>
      <Suspense fallback={null}>
        <SeriesDeepLinkReader onResolve={handleDeepLink} />
      </Suspense>
      <DetailsHero
        series={series}
        src={src}
        blocked={blocked}
        sourceControl={sourceControl}
        playVideo={() => {
          if (blocked) return
          playDefaultSeries()
        }}
        trailerKey={trailerKey}
        logoPath={logoPath}
        playTarget={playTarget}
        isResume={isResume}
        isNext={isResume && resume?.isNext === true}
        onEnded={handleEnded}
        onFinished={handleFinished}
        selfHost={
          blocked || !series?.id
            ? undefined
            : {
                type: 'tv',
                id: series.id,
                season: hostTarget.season,
                episode: hostTarget.episode,
                title: series.name,
                year: Number(series.first_air_date?.slice(0, 4)) || undefined,
                imdb: series.external_ids?.imdb_id || undefined,
              }
        }
        resumeSlot={
          <ContinueWatching progress={progress} episodeName={captionName} />
        }
      />
    </>
  )
}
