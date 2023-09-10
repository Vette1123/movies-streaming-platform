import React from 'react'
import { populateDetailsPageData } from '@/services/movies'

import { DetailsPageContent } from '@/components/media/details-content'
import { DetailsHero } from '@/components/media/details-hero'

const MoviePage = async ({ params }: { params: { id: string } }) => {
  const { movieCredits, movieDetails, similarMovies, recommendedMovies } =
    await populateDetailsPageData(params?.id)

  return (
    <header className="relative">
      <DetailsHero movie={movieDetails} />
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
