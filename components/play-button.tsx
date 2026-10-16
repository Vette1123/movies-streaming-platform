'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { buildMediaEventBase, trackMediaPlayed } from '@/lib/analytics'
import { getMediaTitle } from '@/lib/media'
import { playCue } from '@/lib/play-cue'
import { notePlayForSupportNudge } from '@/lib/support-nudge'
import { cn } from '@/lib/utils'
import { readSeasonEpisodeParams } from '@/hooks/use-search-params'
import { useWatchedMedia } from '@/hooks/use-watched-media'
import { heroWatchButton } from '@/components/ui/hero-action-button'
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
  // ...and that stored episode was finished, so this one starts from the top.
  isNext?: boolean
  className?: string
}

// The hero click is the ONLY tracker of a resume play: SeriesDetailsHero mirrors
// the target into ?season/?episode right after, and startPlayback there skips
// re-tracking the episode already playing.
export function PlayButton({
  onClick,
  media,
  target,
  isResume,
  isNext,
  className,
}: PlayButtonProps) {
  const { handleWatchMedia } = useWatchedMedia()

  const handleClick = () => {
    // Read at click time, not via useSearchParams during render — the hook
    // would force this whole route to client-side render (see use-search-params).
    const { seasonQueryINT, episodeQueryINT } = readSeasonEpisodeParams()
    const isMovie = 'title' in media && !!media.title
    const season = target?.season || seasonQueryINT || 1
    const episode = target?.episode || episodeQueryINT || 1
    notePlayForSupportNudge()
    trackMediaPlayed({
      ...buildMediaEventBase(media, isMovie ? 'movie' : 'tv'),
      ...(isMovie ? {} : { season, episode, is_resume: Boolean(isResume) }),
    })
    handleWatchMedia(media, target ? { season, episode } : undefined)
    onClick()
  }

  const cue = playCue({
    title: getMediaTitle(media) || 'now',
    target,
    isResume,
    isNext,
  })

  return (
    <button
      type="button"
      onClick={handleClick}
      // The visible text says which episode; the name adds the title and spells
      // the numbers out. Both start with the same verb (see lib/play-cue.ts).
      aria-label={cue.label}
      // The same pill as the homepage hero's Watch Now (heroWatchButton), so a
      // title looks like one product on both pages. It used to be a bare round
      // play glyph whose only words were in its aria-label: a series page
      // never SHOWED that it would resume S2 · E3 rather than start the pilot.
      //
      // The accent, not a literal colour: watchNow pairs --primary-fill with
      // --primary-foreground, the pair the token comment in styles/globals.css
      // says holds AA across every supporter palette.
      className={cn(
        heroWatchButton,
        'active:scale-[0.97] motion-reduce:transition-none',
        className
      )}
    >
      <Icons.watch className="mr-2 shrink-0" aria-hidden />
      <span className="tabular-nums">{cue.text}</span>
    </button>
  )
}
