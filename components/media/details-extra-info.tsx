import React from 'react'

import { MovieDetails } from '@/types/movie-details'
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
      overview={movie.overview}
      genres={movie.genres}
      mediaType="movie"
      extraInfo={movieExtraInfoFormatter(movie, director)}
    />
  )
}
