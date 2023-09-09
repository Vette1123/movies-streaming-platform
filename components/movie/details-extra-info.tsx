import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { cn } from '@/lib/utils'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { extraInfoFormatter } from '@/components/movie/extra-info'

export const DetailsExtraInfo = ({ movie }: { movie: MovieDetails }) => {
  const extraInfo = extraInfoFormatter(movie)
  return (
    <div>
      <p className="text-sm font-bold lg:text-3xl">{movie.title}</p>
      <HeroRatesInfos movieDetails={movie} />
      <p className="prose-invert mt-4 text-xs font-semibold lg:text-lg">
        {movie.overview}
      </p>
      <div className="mt-2 flex max-w-sm flex-col space-y-1">
        {extraInfo.map((info) => (
          <div
            key={info.name}
            className="grid grid-cols-2 text-sm font-semibold lg:text-lg"
          >
            <p className="text-muted-foreground">{info.name}</p>
            <p className={cn(info.className)}>{info.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
