'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { trackMediaDetailViewed } from '@/lib/analytics'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { DetailsHero } from '@/components/details-hero'

export const MovieDetailsHero = ({
  movie,
  trailerKey,
}: {
  movie: MovieDetails
  trailerKey?: string
}) => {
  const [isIframeShown, setIsIframeShown] = React.useState(false)
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  React.useEffect(() => {
    if (!movie?.id) return
    trackMediaDetailViewed({
      media_id: movie.id,
      media_type: 'movie',
      title: movie.title,
      vote_average: movie.vote_average,
      release_year: movie.release_date
        ? Number(movie.release_date.slice(0, 4))
        : null,
      genres: movie.genres?.map((g) => g.name),
    })
  }, [movie?.id])

  const playVideo = () => {
    if (iframeRef.current) {
      setIsIframeShown(true)
      iframeRef.current.src = `${STREAMING_MOVIES_API_URL}/movie/${movie?.id}`
    }
  }
  return (
    <DetailsHero
      movie={movie}
      isIframeShown={isIframeShown}
      playVideo={playVideo}
      trailerKey={trailerKey}
      ref={iframeRef}
    />
  )
}
