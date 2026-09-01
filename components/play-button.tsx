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
      // The accent, not a literal colour.
      //
      // This was `from-purple-600 to-blue-500` with a hover into indigo, purple
      // and pink — hard-coded, and the largest control on a detail page. The
      // note beside the supporter accents in styles/globals.css claims "every
      // accented surface in this codebase already reads --primary rather than a
      // literal colour", and this button was the exception that made it untrue:
      // on ember, ocean, forest or rose the page's primary action stayed purple
      // while every other control moved. Measured on production with ember set.
      //
      // `--primary-fill` rather than `--primary` because the glyph on top is
      // solid `--primary-foreground`; that is the pair the token comment says to
      // use wherever a label sits on the accent.
      className={cn(
        'cursor-pointer rounded-full bg-primary-fill text-center font-medium text-primary-foreground transition-[background-color,transform] duration-300 hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.97] motion-reduce:transition-none'
      )}
    >
      <Icons.playIcon
        className={cn('size-16 cursor-pointer sm:size-20 lg:size-24')}
      />
    </button>
  )
}
