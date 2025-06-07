import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import {
  getMovieDetailsById,
  populateMovieDetailsPage,
} from '@/services/movies'

import { PageDetailsProps } from '@/types/page-details'
import { getPosterImageURL } from '@/lib/utils'
import { MoviesDetailsContent } from '@/components/media/details-content'
import { MovieDetailsHero } from '@/components/media/details-hero'

export async function generateMetadata(
  props: PageDetailsProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await props.params
  // read route params
  const id = params.id

  const movieDetails = await getMovieDetailsById(id)

  const previousImages = (await parent).openGraph?.images || []

  return {
    title: movieDetails.title,
    description: movieDetails.overview,
    metadataBase: new URL(`/movies/${id}`, process.env.NEXT_PUBLIC_BASE_URL),
    openGraph: {
      images: [
        ...previousImages,
        getPosterImageURL(movieDetails.poster_path),
        getPosterImageURL(movieDetails.backdrop_path),
      ],
    },
  }
}

const MoviePage = async (props: PageDetailsProps) => {
  const params = await props.params
  const { movieCredits, movieDetails, similarMovies, recommendedMovies } =
    await populateMovieDetailsPage(params?.id)

  return (
    <header className="relative">
      <MovieDetailsHero movie={movieDetails} />
      <MoviesDetailsContent
        movie={movieDetails}
        movieCredits={movieCredits}
        similarMovies={similarMovies}
        recommendedMovies={recommendedMovies}
      />
    </header>
  )
}

export default MoviePage
