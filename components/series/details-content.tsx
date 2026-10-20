import React, { Suspense } from 'react'

import { Credit } from '@/types/credit'
import { MediaType } from '@/types/media'
import { SeriesDetails } from '@/types/series-details'
import { RatingTile } from '@/lib/ratings'
import { recommendedHeading, similarHeading } from '@/lib/seo-title'
import { cn } from '@/lib/utils'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { DetailsCredits } from '@/components/media/details-credits'
import { DETAILS_ROW, DetailsPoster } from '@/components/media/details-poster'
import { RatingsStrip } from '@/components/media/ratings-strip'
import { SectionErrorBoundary } from '@/components/section-error-boundary'
import { SeriesDetailsExtraInfo } from '@/components/series/details-extra-info'
import {
  SeasonNavigator,
  SeasonNavigatorFallback,
} from '@/components/series/season-navigator'

interface SeriesDetailsContentProps {
  series: SeriesDetails
  seriesCredits: Credit
  similarSeries: MediaType[]
  recommendedSeries: MediaType[]
  /** Cast ids with a person page — see lib/person-links.ts. */
  linkedPersonIds?: number[]
  /** The four ratings, resolved by the page. Empty on the fallback shell. */
  ratings?: RatingTile[]
}

// NOT async, and that is load-bearing: this module is imported by
// app/media-fallback/page.tsx, which is 'use client', so an async component
// here is React error #482. The ratings are resolved by the page instead.
export const SeriesDetailsContent = ({
  series,
  seriesCredits,
  similarSeries,
  recommendedSeries,
  linkedPersonIds,
  ratings,
}: SeriesDetailsContentProps) => {
  const director = seriesCredits?.crew?.find(
    (crew) => crew.job === 'Director'
  )?.name
  return (
    <>
      {/* Episodes first, straight under the hero: it is what a series page is
          for. The heading is rendered here, on the server, so the section is
          named in the HTML while the picker under it hydrates — and the id is
          what the hero's "Episodes" action jumps to (scroll-mt clears the fixed
          header). Own Suspense boundary: the picker reads ?season during
          render, and without it the bailout would take the entire page
          client-side. Own ERROR boundary too — episode lists load per season
          over /api, and a failure there should not take the synopsis, cast and
          rails down with it. */}
      <section
        id="episodes"
        aria-labelledby="episodes-heading"
        className="container max-w-(--breakpoint-2xl) scroll-mt-20 pt-6 sm:pt-10"
      >
        <h2
          id="episodes-heading"
          className="mb-4 text-xl font-bold tracking-tight sm:mb-5 sm:text-2xl"
        >
          Episodes
        </h2>
        <SectionErrorBoundary
          section="series_seasons"
          title="Episodes didn't load"
        >
          <Suspense fallback={<SeasonNavigatorFallback />}>
            <SeasonNavigator series={series} />
          </Suspense>
        </SectionErrorBoundary>
      </section>
      <section className="container max-w-(--breakpoint-2xl) pt-12 pb-6 sm:pt-16 lg:pb-10">
        <div className={cn(DETAILS_ROW, 'flex-col')}>
          <DetailsPoster path={series.poster_path} alt={series.name} />
          <section className="flex min-w-0 flex-1 flex-col gap-4">
            <RatingsStrip tiles={ratings ?? []} />
            <SeriesDetailsExtraInfo series={series} director={director} />
            <DetailsCredits
              movieCredits={seriesCredits}
              linkedPersonIds={linkedPersonIds}
            />
          </section>
        </div>
      </section>
      {/* Full-bleed rails — same width/gutter as the homepage rows. */}
      <div className="pb-10 lg:pb-20">
        <Suspense fallback={<SliderHorizontalListLoader />}>
          <List
            title={recommendedHeading(series.name)}
            items={recommendedSeries}
            itemType="tv"
          />
        </Suspense>
        <Suspense fallback={<SliderHorizontalListLoader />}>
          <List
            title={similarHeading(series.name, 'series')}
            items={similarSeries}
            itemType="tv"
          />
        </Suspense>
      </div>
    </>
  )
}
