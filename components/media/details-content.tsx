import React, { Suspense } from 'react'

import { Credit } from '@/types/credit'
import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { RatingTile } from '@/lib/ratings'
import { recommendedHeading, similarHeading } from '@/lib/seo-title'
import { cn } from '@/lib/utils'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { CollectionBanner } from '@/components/media/collection-banner'
import { DetailsCredits } from '@/components/media/details-credits'
import { DetailsExtraInfo } from '@/components/media/details-extra-info'
import { DETAILS_ROW, DetailsPoster } from '@/components/media/details-poster'
import { RatingsStrip } from '@/components/media/ratings-strip'
import { Breadcrumb } from '@/components/ui/breadcrumb'

// NOT async, and that is load-bearing.
//
// This module is imported by app/media-fallback/page.tsx, which is 'use
// client' — so this module is in the CLIENT graph, and an async component in
// the client graph is React error #482 ("an unknown Component is an async
// Client Component"). The ratings are resolved by the page (a server
// component) and handed in instead.
export const MoviesDetailsContent = ({
  movie,
  movieCredits,
  movieCrew,
  similarMovies,
  recommendedMovies,
  linkedPersonIds,
  ratings,
}: {
  movie: MovieDetails
  movieCredits: Credit
  /** Full crew array (all jobs) for person-page link resolution. */
  movieCrew?: Credit['crew']
  similarMovies: Movie[]
  recommendedMovies: Movie[]
  /** Cast ids with a person page — see lib/person-links.ts. */
  linkedPersonIds?: number[]
  /** The four ratings, resolved by the page. Empty on the fallback shell. */
  ratings?: RatingTile[]
}) => {
  const director = movieCredits?.crew?.find(
    (crew) => crew.job === 'Director'
  )?.name
  return (
    <>
      <section className="container max-w-(--breakpoint-2xl) pt-8 pb-6 sm:pt-12 lg:pb-10">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Movies', href: '/movies' },
            { label: movie.title, href: `/movies/${movie.id}` },
          ]}
          className="mb-6"
        />
        <div className={cn(DETAILS_ROW, 'flex-col')}>
          <DetailsPoster path={movie.poster_path} alt={movie.title} />
          <section className="flex min-w-0 flex-1 flex-col gap-4">
            <RatingsStrip tiles={ratings ?? []} />
            <DetailsExtraInfo movie={movie} director={director} />
            <DetailsCredits
              movieCredits={movieCredits}
              movieCrew={movieCrew}
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
          <List
            title={recommendedHeading(movie.title)}
            items={recommendedMovies}
          />
        </Suspense>
        <Suspense fallback={<SliderHorizontalListLoader />}>
          <List
            title={similarHeading(movie.title, 'movie')}
            items={similarMovies}
          />
        </Suspense>
      </div>
    </>
  )
}
