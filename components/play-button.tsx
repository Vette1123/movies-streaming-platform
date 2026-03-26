'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { cn } from '@/lib/utils'
import { useWatchedMedia } from '@/hooks/use-watched-media'
import { Icons } from '@/components/icons'

interface PlayButtonProps {
  onClick: () => void
  media: MovieDetails & SeriesDetails
}

export function PlayButton({ onClick, media }: PlayButtonProps) {
  const { handleWatchMedia } = useWatchedMedia()

  const handleClick = () => {
    handleWatchMedia(media)
    onClick()
  }

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings */}
      <span className="absolute inline-flex size-28 animate-ping rounded-full bg-purple-500/30" />
      <span className="absolute inline-flex size-32 animate-ping rounded-full bg-blue-500/20 [animation-delay:0.4s]" />
      <div className="relative rounded-full bg-linear-to-br from-purple-600 to-blue-500 text-center font-medium text-white shadow-2xl shadow-purple-500/40 transition-all duration-500 hover:scale-110 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 hover:shadow-pink-500/40">
        <Icons.playIcon
          onClick={handleClick}
          className={cn('size-24 cursor-pointer')}
        />
      </div>
    </div>
  )
}
