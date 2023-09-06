import React from 'react'
import { getLatestPopularMovies } from '@/services/movies'

import Carousel from '@/components/carousel'
import { HeroImage } from '@/components/header/hero-image'
import { HeroSectionInfo } from '@/components/header/hero-info'

export const HeroSlider = async () => {
  const latestMovies = await getLatestPopularMovies()

  return (
    <div className="relative overflow-hidden">
      <Carousel>
        {latestMovies?.results.map((movie) => (
          // flex-[0_0_100%] is a custom class that sets flex-basis: 100%
          // and flex-grow: 0 and flex-shrink: 0
          // This is to make sure that the carousel items don't grow or shrink
          // when the carousel is initialized
          // https://tailwindcss.com/docs/flex-grow
          <div
            key={movie.id}
            className="embla__slide relative min-h-[500px] flex-[0_0_100%] overflow-hidden lg:min-h-screen"
          >
            <HeroImage movie={movie} />
            <HeroSectionInfo movie={movie} />
            <div className="pointer-events-none absolute -inset-4 rounded-md bg-slate-900/50 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
          </div>
        ))}
      </Carousel>
      <div className="pointer-events-none absolute bottom-0 h-32 w-full bg-gradient-to-t from-black to-transparent" />
    </div>
  )
}
