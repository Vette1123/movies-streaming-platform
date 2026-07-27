'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { buildMediaEventBase, trackMediaPlayed } from '@/lib/analytics'
import { getMediaTitle } from '@/lib/media'
import { cn } from '@/lib/utils'
import { readSeasonEpisodeParams } from '@/hooks/use-search-params'
import { useWatchedMedia } from '@/hooks/use-watched-media'
import { Icons } from '@/components/icons'

interface PlayButtonProps {
  onClick: () => void
  media: MovieDetails & SeriesDetails
  // Series only: the episode this click will actually start — continue-watching
  // or the ?season/?episode the page was opened on. Drives both the event and
  // the watch-history write.
  target?: { season: number; episode: number } | null
  // The target came from stored progress, not from the URL.
  isResume?: boolean
}

// The hero click is the ONLY tracker of a resume play: SeriesDetailsHero mirrors
// the target into ?season/?episode right after, and startPlayback there skips
// re-tracking the episode already playing.
const playVerb = (isResume?: boolean) => (isResume ? 'Resume' : 'Watch')

const playButtonLabel = (
  title: string,
  target?: { season: number; episode: number } | null,
  isResume?: boolean
) => {
  if (!target) return `Watch ${title}`
  return `${playVerb(isResume)} ${title}, season ${target.season} episode ${target.episode}`
}

export function PlayButton({
  onClick,
  media,
  target,
  isResume,
}: PlayButtonProps) {
  const { handleWatchMedia } = useWatchedMedia()

  const handleClick = () => {
    // Read at click time, not via useSearchParams during render — the hook
    // would force this whole route to client-side render (see use-search-params).
    const { seasonQueryINT, episodeQueryINT } = readSeasonEpisodeParams()
    const isMovie = 'title' in media && !!media.title
    const season = target?.season || seasonQueryINT || 1
    const episode = target?.episode || episodeQueryINT || 1
    trackMediaPlayed({
      ...buildMediaEventBase(media, isMovie ? 'movie' : 'tv'),
      ...(isMovie ? {} : { season, episode, is_resume: Boolean(isResume) }),
    })
    handleWatchMedia(media, target ? { season, episode } : undefined)
    onClick()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={playButtonLabel(
        getMediaTitle(media) || 'now',
        target,
        isResume
      )}
      className={cn(
        'focus-visible:ring-ring cursor-pointer rounded-full bg-linear-to-br from-purple-600 to-blue-500 text-center font-medium text-white transition-colors duration-500 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden'
      )}
    >
      <Icons.playIcon
        className={cn('size-16 cursor-pointer sm:size-20 lg:size-24')}
      />
    </button>
  )
}
