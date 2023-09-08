import React from 'react'
import { getMovieDetailsById } from '@/services/movies'

import { DetailsHero } from '@/components/movie/details-hero'

const MoviePage = async ({ params }: { params: { id: string } }) => {
  const movieDetails = await getMovieDetailsById(params?.id)
  return (
    <header className="relative">
      <DetailsHero movie={movieDetails} />
    </header>
  )
}

export default MoviePage
