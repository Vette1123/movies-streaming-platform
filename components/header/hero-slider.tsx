import React from 'react'

import { Movie } from '@/types/movie-result'
import { Carousel } from '@/components/carousel'
import { HeroImage, HeroImageMedia } from '@/components/header/hero-image'
import { HeroSectionInfo } from '@/components/header/hero-info'

export const HeroSlider = async ({ movies }: { movies: Movie[] }) => {
  return (
    <div className="relative overflow-hidden">
      <Carousel>
        {movies?.map((movie) => (
          <div
            key={movie.id}
            className="relative min-h-[500px] overflow-hidden lg:min-h-screen"
          >
            <HeroImage movie={movie as HeroImageMedia} />
            <HeroSectionInfo movie={movie} />
            <div className="pointer-events-none absolute -inset-4 rounded-md bg-slate-900/50 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
          </div>
        ))}
      </Carousel>
      <div className="pointer-events-none absolute bottom-0 h-32 w-full bg-gradient-to-t from-black to-transparent" />
    </div>
  )
}
