import React from 'react'
import Image from 'next/image'
import { getLatestPopularMovies } from '@/services/movies'

import { getImageURL } from '@/lib/utils'

import Carousel from '../carousel'

export const HeroSlider = async () => {
  const latestMovies = await getLatestPopularMovies()

  return (
    <div className="relative overflow-hidden">
      <Carousel>
        {latestMovies?.results.map((src) => (
          // flex-[0_0_100%] is a custom class that sets flex-basis: 100%
          // and flex-grow: 0 and flex-shrink: 0
          // This is to make sure that the carousel items don't grow or shrink
          // when the carousel is initialized
          // https://tailwindcss.com/docs/flex-grow
          <div
            key={src.id}
            className="relative min-h-[200px] flex-[0_0_100%] lg:min-h-screen"
          >
            <Image
              src={getImageURL(src.backdrop_path)}
              alt={src.title}
              className="absolute inset-0 -z-10 h-full w-full bg-center bg-no-repeat object-cover"
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              priority
            />
          </div>
        ))}
      </Carousel>
      <div className="pointer-events-none absolute -inset-4 z-40 rounded-md bg-slate-700/50 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
      <div className="absolute bottom-0 h-40 w-full bg-gradient-to-t from-black to-transparent" />
    </div>
  )
}
