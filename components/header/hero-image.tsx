import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

export type HeroImageMedia = (Movie | MovieDetails) & SeriesDetails
interface HeroImageProps {
  movie?: HeroImageMedia
}

export const HeroImage = ({ movie }: HeroImageProps) => {
  const media = movie
  const alt = media?.title || media?.name || 'ALT TEXT'
  return (
    <>
      {media?.backdrop_path && (
        <BlurredImage
          src={getImageURL(media?.backdrop_path)}
          alt={alt}
          className="hidden h-full w-full object-cover lg:block"
          fill
          sizes="(min-width: 1024px) 1024px, 100vw , (max-width: 768px) 768px, 100vw, (max-width: 640px) 640px, 100vw"
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
