'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { trackMediaPlayed } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { useWatchedMedia } from '@/hooks/use-watched-media'
import { Icons } from '@/components/icons'

interface PlayButtonProps {
  onClick: () => void
  media: MovieDetails & SeriesDetails
}

export function PlayButton({ onClick, media }: PlayButtonProps) {
  const { handleWatchMedia } = useWatchedMedia()
  const { seasonQueryINT, episodeQueryINT } = useSearchQueryParams()

  const handleClick = () => {
    const isMovie = 'title' in media && !!media.title
    const releaseStr = media?.release_date || media?.first_air_date
    trackMediaPlayed({
      media_id: media?.id,
      media_type: isMovie ? 'movie' : 'tv',
      title: media?.title || media?.name,
      ...(isMovie
        ? {}
        : {
            season: seasonQueryINT || 1,
            episode: episodeQueryINT || 1,
          }),
      vote_average: media?.vote_average,
      release_year: releaseStr ? Number(releaseStr.slice(0, 4)) : null,
      genres: media?.genres?.map((g) => g.name),
    })
    handleWatchMedia(media)
    onClick()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Watch ${media?.title || media?.name || 'now'}`}
      className={cn(
        'focus-visible:ring-ring cursor-pointer rounded-full bg-linear-to-br from-purple-600 to-blue-500 text-center font-medium text-white transition-colors duration-500 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden'
      )}
    >
      <Icons.playIcon className={cn('size-16 cursor-pointer sm:size-20 lg:size-24')} />
    </button>
  )
}
