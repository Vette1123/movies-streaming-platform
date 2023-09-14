import React from 'react'
import { populateMovieDetailsPage } from '@/services/movies'

import { DetailsPageContent } from '@/components/media/details-content'
import { MovieDetailsHero } from '@/components/media/details-hero'

const MoviePage = async ({ params }: { params: { id: string } }) => {
  const { movieCredits, movieDetails, similarMovies, recommendedMovies } =
    await populateMovieDetailsPage(params?.id)

  return (
    <header className="relative">
      <MovieDetailsHero movie={movieDetails} />
      <DetailsPageContent
        movie={movieDetails}
        movieCredits={movieCredits}
        similarMovies={similarMovies}
        recommendedMovies={recommendedMovies}
      />
    </header>
  )
}

export default MoviePage
