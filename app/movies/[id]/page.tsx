import React from 'react'
import { populateDetailsPageData } from '@/services/movies'

import { DetailsPageContent } from '@/components/movie/details-content'
import { DetailsHero } from '@/components/movie/details-hero'

const MoviePage = async ({ params }: { params: { id: string } }) => {
  const { movieCredits, movieDetails } = await populateDetailsPageData(
    params?.id
  )
  return (
    <header className="relative">
      <DetailsHero movie={movieDetails} />
      <DetailsPageContent movie={movieDetails} movieCredits={movieCredits} />
    </header>
  )
}

export default MoviePage
