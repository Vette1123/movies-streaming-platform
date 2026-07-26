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
  // Series only: the episode this click will actually start. A continue-watching
  // resume is not in the URL yet, so it takes priority over the (empty)
  // ?season/?episode read for both the event and the watch-history write.
  resume?: { season: number; episode: number } | null
}

// The hero click is the ONLY tracker of a resume play: SeriesDetailsHero pushes
// ?season/?episode right after, and its deep-link effect deliberately skips
// re-tracking the episode already playing (see startPlayback there).
const playButtonLabel = (
  title: string,
  resume?: { season: number; episode: number } | null
) => {
  if (!resume) return `Watch ${title}`
  return `Resume ${title}, season ${resume.season} episode ${resume.episode}`
}

export function PlayButton({ onClick, media, resume }: PlayButtonProps) {
  const { handleWatchMedia } = useWatchedMedia()

  const handleClick = () => {
    // Read at click time, not via useSearchParams during render — the hook
    // would force this whole route to client-side render (see use-search-params).
    const { seasonQueryINT, episodeQueryINT } = readSeasonEpisodeParams()
    const isMovie = 'title' in media && !!media.title
    const season = resume?.season || seasonQueryINT || 1
    const episode = resume?.episode || episodeQueryINT || 1
    trackMediaPlayed({
      ...buildMediaEventBase(media, isMovie ? 'movie' : 'tv'),
      ...(isMovie ? {} : { season, episode, is_resume: Boolean(resume) }),
    })
    handleWatchMedia(media, resume ? { season, episode } : undefined)
    onClick()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={playButtonLabel(getMediaTitle(media) || 'now', resume)}
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
