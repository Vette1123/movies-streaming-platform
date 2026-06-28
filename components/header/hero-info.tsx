import React from 'react'

import { Movie } from '@/types/movie-result'
import { getPosterImageURL, isRecentlyReleased } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { NewBadge } from '@/components/new-badge'
import { AnimatedWatchButton } from '@/components/header/animated-watch-button'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'

export const HeroSectionInfo = ({ movie }: { movie: Movie }) => {
  const isNew = isRecentlyReleased(movie.release_date || movie.first_air_date)

  return (
    <div className="absolute inset-0 z-50 pb-36 lg:pb-0">
      <div className="relative container flex h-full items-center justify-center gap-x-8 pt-20 lg:pt-28">
        <div className="flex w-full grow flex-col">
          <div>
            {isNew && (
              <NewBadge className="relative left-0 top-0 mb-3 px-2.5 py-1 text-[11px] lg:text-xs" />
            )}
            <h2 className="text-sm font-bold lg:text-6xl">
              {movie.title || movie.name}
            </h2>
            <HeroRatesInfos movie={movie} />
            <p className="prose-invert mt-2 text-xs font-bold lg:text-lg">
              {movie.overview}
            </p>
          </div>
          <AnimatedWatchButton
            movieId={movie?.id}
            mediaType={movie?.media_type}
          />
        </div>
        <div className="hidden lg:flex">
          <div className="relative min-h-[700px] w-[400px]">
            <BlurredImage
              src={getPosterImageURL(movie.poster_path)}
              alt={movie.title || movie.name || 'Media poster'}
              className="pointer-events-none size-full rounded-lg object-fill shadow-lg lg:object-cover"
              fill
              sizes="(min-width: 1024px) 1024px, 30vw"
              intro
              priority
            />
          </div>
        </div>
      </div>
    </div>
  )
}
