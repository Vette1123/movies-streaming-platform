import React, { Suspense } from 'react'

import { Credit } from '@/types/credit'
import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { DetailsCredits } from '@/components/media/details-credits'
import { DetailsExtraInfo } from '@/components/media/details-extra-info'

export const MoviesDetailsContent = ({
  movie,
  movieCredits,
  similarMovies,
  recommendedMovies,
}: {
  movie: MovieDetails
  movieCredits: Credit
  similarMovies: Movie[]
  recommendedMovies: Movie[]
}) => {
  const director = movieCredits?.crew?.find(
    (crew) => crew.job === 'Director'
  )?.name

  return (
    <section className="container max-w-(--breakpoint-2xl) pb-10 pt-10 lg:pb-24">
      {/* Poster — mobile only */}
      <div className="mb-6 flex justify-center lg:hidden">
        <div className="relative h-[210px] w-[140px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
          <BlurredImage
            src={getPosterImageURL(movie.poster_path)}
            alt={movie.title}
            className="size-full object-cover"
            fill
            sizes="140px"
          />
        </div>
      </div>

      {/* Main info row */}
      <div className="flex flex-col gap-10 lg:flex-row">
        {/* Poster — desktop only */}
        <div className="hidden shrink-0 lg:block">
          <div className="relative h-[540px] w-[360px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
            <BlurredImage
              src={getPosterImageURL(movie.poster_path)}
              alt={movie.title}
              className="size-full object-cover"
              fill
              sizes="360px"
              intro
            />
          </div>
        </div>

        {/* Info + cast */}
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <DetailsExtraInfo movie={movie} director={director} />
          <div className="border-t border-white/10 pt-6">
            <DetailsCredits movieCredits={movieCredits} />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendedMovies.length > 0 && (
        <div className="mt-12 border-t border-white/10 pt-8">
          <Suspense fallback={<SliderHorizontalListLoader />}>
            <List title="Recommended" items={recommendedMovies} itemType="movie" />
          </Suspense>
        </div>
      )}
      {similarMovies.length > 0 && (
        <div className="mt-4">
          <Suspense fallback={<SliderHorizontalListLoader />}>
            <List title="More Like This" items={similarMovies} itemType="movie" />
          </Suspense>
        </div>
      )}
    </section>
  )
}
