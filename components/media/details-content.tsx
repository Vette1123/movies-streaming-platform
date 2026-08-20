import React, { Suspense } from 'react'

import { Credit } from '@/types/credit'
import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { CollectionBanner } from '@/components/media/collection-banner'
import { DetailsCredits } from '@/components/media/details-credits'
import { DetailsExtraInfo } from '@/components/media/details-extra-info'
import { DetailsPoster } from '@/components/media/details-poster'

export const MoviesDetailsContent = ({
  movie,
  movieCredits,
  similarMovies,
  recommendedMovies,
  linkedPersonIds,
}: {
  movie: MovieDetails
  movieCredits: Credit
  similarMovies: Movie[]
  recommendedMovies: Movie[]
  /** Cast ids with a person page — see lib/person-links.ts. */
  linkedPersonIds?: number[]
}) => {
  const director = movieCredits?.crew?.find(
    (crew) => crew.job === 'Director'
  )?.name
  return (
    <>
      <section className="container max-w-(--breakpoint-2xl) pt-12 pb-6 lg:pb-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          <DetailsPoster path={movie.poster_path} alt={movie.title} />
          <section className="flex flex-col gap-4">
            <DetailsExtraInfo movie={movie} director={director} />
            <DetailsCredits
              movieCredits={movieCredits}
              linkedPersonIds={linkedPersonIds}
            />
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
