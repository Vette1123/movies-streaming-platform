'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { DetailsHero } from '@/components/details-hero'

export const MovieDetailsHero = ({ movie }: { movie: MovieDetails }) => {
  const [isIframeShown, setIsIframeShown] = React.useState(false)
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  const playVideo = () => {
    if (iframeRef.current) {
      setIsIframeShown(true)
      iframeRef.current.src = `${STREAMING_MOVIES_API_URL}/movie/${movie?.id}?autoplay=1`
    }
  }
  return (
    <DetailsHero
      movie={movie}
      isIframeShown={isIframeShown}
      playVideo={playVideo}
      ref={iframeRef}
    />
  )
}
