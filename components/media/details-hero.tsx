'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { DetailsHero } from '@/components/details-hero'

export const MovieDetailsHero = ({ movie }: { movie: MovieDetails }) => {
  const [isVideoShown, setIsVideoShown] = React.useState(false)
  const [videoUrl, setVideoUrl] = React.useState<string | undefined>()

  const playVideo = () => {
    setIsVideoShown(true)
    // Mock video URL for testing since we don't have a real m3u8 API
    setVideoUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')
  }

  return (
    <DetailsHero
      movie={movie}
      isVideoShown={isVideoShown}
      playVideo={playVideo}
      videoUrl={videoUrl}
    />
  )
}
