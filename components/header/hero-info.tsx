import React from 'react'
import Image from 'next/image'

import { Movie } from '@/types/movie-result'
import { getPosterImageURL } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import { Icons } from '../icons'
import { HeroRatesInfos } from './hero-rates-info'

export const HeroSectionInfo = ({ movie }: { movie: Movie }) => {
  return (
    <div className="container relative z-50 h-full py-16 lg:py-24">
      <div className="flex h-full items-center justify-center gap-x-8">
        <div className="flex w-full grow flex-col">
          <div>
            <h2 className="text-sm font-bold lg:text-6xl">{movie.title}</h2>
            <HeroRatesInfos movie={movie} />
            <p className="prose-invert mt-4 text-xs font-bold lg:text-lg">
              {movie.overview}
            </p>
          </div>
          <div className="flex justify-center lg:justify-start">
            <Button className="mt-8" size="2xl" variant="watchNow">
              <Icons.watch className="mr-2" />
              Watch Now
            </Button>
          </div>
        </div>
        <div className="hidden lg:flex">
          <div className="relative min-h-[700px] w-[400px]">
            <Image
              src={getPosterImageURL(movie.poster_path)}
              alt={movie.title}
              className="h-full w-full rounded-lg object-fill shadow-lg lg:object-cover"
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  )
}
