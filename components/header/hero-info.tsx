import React from 'react'

import { Movie } from '@/types/movie-result'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { AnimatedWatchButton } from '@/components/header/animated-watch-button'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'

export const HeroSectionInfo = ({ movie }: { movie: Movie }) => {
  return (
    <div className="container relative z-50 h-full pt-20 lg:pt-28">
      <div className="flex h-full items-center justify-center gap-x-8">
        <div className="flex w-full grow flex-col">
          <div>
            <h2 className="text-sm font-bold lg:text-6xl">{movie.title}</h2>
            <HeroRatesInfos movie={movie} />
            <p className="prose-invert mt-2 text-xs font-bold lg:text-lg">
              {movie.overview}
            </p>
          </div>
          <AnimatedWatchButton movieId={movie?.id} />
        </div>
        <div className="hidden lg:flex">
          <div className="relative min-h-[700px] w-[400px]">
            <BlurredImage
              src={getPosterImageURL(movie.poster_path)}
              alt={movie.title}
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
