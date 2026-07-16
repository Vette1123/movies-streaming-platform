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
  // The landscape backdrop fills the hero edge-to-edge on every breakpoint
  // (no side bars). Only when there's no backdrop do we fall back to the
  // portrait poster, cover-cropped so it still fills the frame full width.
  return (
    <>
      {media?.backdrop_path ? (
        <BlurredImage
          src={getImageURL(media?.backdrop_path)}
          alt={alt}
          className="animate-hero-kenburns block size-full object-cover object-top will-change-transform motion-reduce:animate-none"
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          intro
          priority
        />
      ) : (
        media?.poster_path && (
          <BlurredImage
            src={getPosterImageURL(media?.poster_path)}
            alt={alt}
            className="animate-hero-kenburns block size-full object-cover object-center will-change-transform motion-reduce:animate-none"
            fill
            sizes="100vw"
            intro
            priority
          />
        )
      )}
    </>
  )
}
