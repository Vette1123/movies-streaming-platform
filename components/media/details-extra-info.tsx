import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { DetailsExtraInfoLayout } from '@/components/media/details-extra-info-layout'
import { movieExtraInfoFormatter } from '@/components/media/extra-info'

export const DetailsExtraInfo = ({
  movie,
  director,
}: {
  movie: MovieDetails
  director: string | undefined
}) => {
  return (
    <DetailsExtraInfoLayout
      title={movie.title}
      badgeDate={movie.release_date}
      tagline={movie.tagline}
      overview={movie.overview}
      genres={movie.genres}
      mediaType="movie"
      heroRates={<HeroRatesInfos movieDetails={movie} />}
      extraInfo={movieExtraInfoFormatter(movie, director)}
    />
  )
}
