'use client'

import React from 'react'
import { Splide, SplideSlide } from '@splidejs/react-splide'

import { MovieResponse } from '@/types/movie-result'

import { HeroImage } from './hero-image'
import { HeroSectionInfo } from './hero-info'

export const Testing = ({ latestMovies }: { latestMovies: MovieResponse }) => {
  return (
    <Splide>
      {latestMovies?.results.map((movie) => (
        // flex-[0_0_100%] is a custom class that sets flex-basis: 100%
        // and flex-grow: 0 and flex-shrink: 0
        // This is to make sure that the carousel items don't grow or shrink
        // when the carousel is initialized
        // https://tailwindcss.com/docs/flex-grow
        <SplideSlide
          key={movie.id}
          className="relative min-h-[500px] flex-[0_0_100%] overflow-hidden lg:min-h-screen"
        >
          <HeroImage movie={movie} />
          <HeroSectionInfo movie={movie} />
          <div className="pointer-events-none absolute -inset-4 rounded-md bg-slate-900/50 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
        </SplideSlide>
      ))}
    </Splide>
  )
}
