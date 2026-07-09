import React from 'react'

import { Movie } from '@/types/movie-result'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { AnimatedWatchButton } from '@/components/header/animated-watch-button'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

export const HeroSectionInfo = ({ movie }: { movie: Movie }) => {
  return (
    <div className="absolute inset-0 z-50 pb-36 lg:pb-0">
      <div className="relative container flex h-full items-center justify-center gap-x-8 pt-20 lg:pt-28">
        <div className="flex w-full grow flex-col">
          <div className="max-w-2xl">
            <NewBadgeWhenRecent
              date={movie.release_date || movie.first_air_date}
              className="relative top-0 left-0 mb-3 px-2.5 py-1 text-[11px] lg:text-xs"
            />
            <h2 className="text-3xl font-bold tracking-tight whitespace-nowrap text-white drop-shadow-md sm:text-4xl lg:text-6xl">
              {movie.title || movie.name}
            </h2>
            <HeroRatesInfos movie={movie} />
            <p className="mt-2 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/85 drop-shadow-sm lg:mt-3 lg:max-w-2xl lg:text-lg">
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
              className="pointer-events-none size-full rounded-xl object-fill shadow-2xl ring-1 ring-white/10 lg:object-cover"
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
