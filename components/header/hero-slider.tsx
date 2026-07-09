import React from 'react'

import { Movie } from '@/types/movie-result'
import { Carousel } from '@/components/carousel'
import { HeroImage, HeroImageMedia } from '@/components/header/hero-image'
import { HeroSectionInfo } from '@/components/header/hero-info'

export const HeroSlider = async ({ movies }: { movies: Movie[] }) => {
  return (
    <div className="relative overflow-hidden">
      <Carousel storageKey="hero-carousel">
        {movies?.map((movie) => (
          <div
            key={movie.id}
            className="relative min-h-[500px] overflow-hidden lg:min-h-screen"
          >
            <HeroImage movie={movie as HeroImageMedia} />
            {/* Cinematic legibility scrim — dark behind the copy on the left,
                clearing toward the poster on the right so the artwork breathes. */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/20 lg:to-transparent" />
            {/* Vertical grounding for the title, meta row and CTA. */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
            <HeroSectionInfo movie={movie} />
          </div>
        ))}
      </Carousel>
      <div className="pointer-events-none absolute bottom-0 h-32 w-full bg-linear-to-t from-black to-transparent" />
    </div>
  )
}
