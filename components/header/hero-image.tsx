import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

export const HeroImage = ({ movie }: { movie: Movie | MovieDetails }) => {
  return (
    <>
      {movie.backdrop_path && (
        <BlurredImage
          src={getImageURL(movie.backdrop_path)}
          alt={movie.title}
          className="hidden h-full w-full object-cover lg:block"
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          intro
        />
      )}
      {movie.poster_path && (
        <BlurredImage
          src={getPosterImageURL(movie.poster_path)}
          alt={movie.title}
          className="block h-full w-full object-cover lg:hidden"
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          intro
        />
      )}
    </>
  )
}
