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
    <div className="rounded-full bg-linear-to-br from-purple-600 to-blue-500 text-center font-medium text-white transition-colors duration-500 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500">
      <Icons.playIcon
        onClick={handleClick}
        className={cn('size-24 cursor-pointer')}
      />
    </div>
  )
}
