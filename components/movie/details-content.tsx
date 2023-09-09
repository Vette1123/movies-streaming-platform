import React from 'react'
import Image from 'next/image'

import { MovieDetails } from '@/types/movie-details'
import { getPosterImageURL } from '@/lib/utils'

import { DetailsExtraInfo } from './details-extra-info'

export const DetailsPageContent = ({ movie }: { movie: MovieDetails }) => {
  return (
    <section className="container pb-10 pt-12 lg:pb-20">
      <div className="flex gap-8">
        <div className="hidden lg:flex">
          <div className="relative min-h-[700px] w-[400px]">
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
        <DetailsExtraInfo movie={movie} />
      </div>
    </section>
  )
}
