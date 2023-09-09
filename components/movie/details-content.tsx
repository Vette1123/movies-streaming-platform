import React from 'react'
import Image from 'next/image'

import { MovieCredits, MovieDetails } from '@/types/movie-details'
import { getPosterImageURL } from '@/lib/utils'
import { DetailsExtraInfo } from '@/components/movie/details-extra-info'

import { DetailsCredits } from './details-credits'

export const DetailsPageContent = ({
  movie,
  movieCredits,
}: {
  movie: MovieDetails
  movieCredits: MovieCredits
}) => {
  const director = movieCredits?.crew?.find((crew) => crew.job === 'Director')
    ?.name
  return (
    <section className="container pb-10 pt-12 lg:pb-20">
      <div className="flex flex-row gap-8">
        <div className="hidden lg:block">
          <div className="relative min-h-[600px] w-[400px]">
            <Image
              src={getPosterImageURL(movie.poster_path)}
              alt={movie.title}
              className="h-full w-full rounded-lg object-fill shadow-lg lg:object-cover"
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              priority
            />
          </div>
        </div>
        <section className="flex flex-col gap-4">
          <DetailsExtraInfo movie={movie} director={director} />
          <DetailsCredits movieCredits={movieCredits} />
        </section>
      </div>
    </section>
  )
}
