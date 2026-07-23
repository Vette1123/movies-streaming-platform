import React, { Suspense } from 'react'

import { Credit } from '@/types/credit'
import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { CollectionBanner } from '@/components/media/collection-banner'
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
    <>
      <section className="container max-w-(--breakpoint-2xl) pt-12 pb-6 lg:pb-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="mx-auto w-full max-w-[220px] shrink-0 sm:max-w-[260px] lg:mx-0 lg:w-[400px] lg:max-w-none">
            <div className="relative aspect-2/3 w-full lg:aspect-auto lg:min-h-[600px]">
              <BlurredImage
                src={getPosterImageURL(movie.poster_path)}
                alt={movie.title}
                className="h-full w-full rounded-lg object-cover shadow-lg"
                fill
                sizes="(min-width: 1024px) 400px, 260px"
                intro
              />
            </div>
          </div>
          <section className="flex flex-col gap-4">
            <DetailsExtraInfo movie={movie} director={director} />
            <DetailsCredits movieCredits={movieCredits} />
          </section>
        </div>
        <CollectionBanner movie={movie} />
      </section>
      {/* Full-bleed rails — same width/gutter as the homepage rows (the List
          owns its gutter). Kept OUT of the centered `container` above so they
          don't render narrower than home. */}
      <div className="pb-10 lg:pb-20">
        <Suspense fallback={<SliderHorizontalListLoader />}>
          <List title="Recommended Movies" items={recommendedMovies} />
        </Suspense>
        <Suspense fallback={<SliderHorizontalListLoader />}>
          <List title="Similar Movies" items={similarMovies} />
        </Suspense>
      </div>
    </>
  )
}
