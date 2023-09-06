'use client'

import React from 'react'
import Image from 'next/image'

import { Movie } from '@/types/movie-result'
import { getImageURL, getPosterImageURL } from '@/lib/utils'

export const HeroImage = ({ movie }: { movie: Movie }) => {
  return (
    <>
      <Image
        src={getImageURL(movie.backdrop_path)}
        alt={movie.title}
        className="absolute inset-0 -z-10 hidden h-full w-full object-cover lg:block"
        fill
        sizes="(min-width: 1024px) 1024px, 100vw"
        priority
      />
      <Image
        src={getPosterImageURL(movie.poster_path)}
        alt={movie.title}
        className="absolute inset-0 -z-10 block h-full w-full object-cover lg:hidden"
        fill
        sizes="(min-width: 1024px) 1024px, 100vw"
        priority
      />
    </>
  )
}
