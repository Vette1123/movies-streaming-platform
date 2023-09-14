import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

interface HeroImageProps {
  movie?: Movie | MovieDetails
  series?: SeriesDetails
}

export const HeroImage = ({ movie, series }: HeroImageProps) => {
  const media = (movie || series) as MovieDetails & SeriesDetails & Movie
  const alt = media?.title || media?.name
  return (
    <>
      {media?.backdrop_path && (
        <BlurredImage
          src={getImageURL(media?.backdrop_path)}
          alt={alt}
          className="hidden h-full w-full object-cover lg:block"
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          intro
          priority
        />
      )}
      {media?.poster_path && (
        <BlurredImage
          src={getPosterImageURL(media?.poster_path)}
          alt={alt}
          className="block h-full w-full object-cover lg:hidden"
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          intro
          priority
        />
      )}
    </>
  )
}
