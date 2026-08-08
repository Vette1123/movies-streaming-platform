'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { buildMediaEventBase, trackMediaDetailViewed } from '@/lib/analytics'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { DetailsHero } from '@/components/details-hero'

export const MovieDetailsHero = ({
  movie,
  trailerKey,
}: {
  movie: MovieDetails
  trailerKey?: string
}) => {
  // The embed URL, empty until play is pressed — see the note on DetailsHero.
  // This used to write iframeRef.current.src behind an `if (iframeRef.current)`
  // guard, so a play that landed while the ref was empty did nothing at all and
  // said nothing about it.
  const [src, setSrc] = React.useState('')

  React.useEffect(() => {
    if (!movie?.id) return
    trackMediaDetailViewed(buildMediaEventBase(movie, 'movie'))
  }, [movie?.id])

  const playVideo = () =>
    setSrc(`${STREAMING_MOVIES_API_URL}/movie/${movie?.id}`)

  return (
    <DetailsHero
      movie={movie}
      src={src}
      playVideo={playVideo}
      trailerKey={trailerKey}
    />
  )
}
