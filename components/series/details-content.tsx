import React, { Suspense } from 'react'

import { Credit } from '@/types/credit'
import { MediaType } from '@/types/media'
import { SeriesDetails } from '@/types/series-details'
import { recommendedHeading, similarHeading } from '@/lib/seo-title'
import { cn } from '@/lib/utils'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { DetailsCredits } from '@/components/media/details-credits'
import { DETAILS_ROW, DetailsPoster } from '@/components/media/details-poster'
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
}

export const SeriesDetailsContent = ({
  series,
  seriesCredits,
  similarSeries,
  recommendedSeries,
  linkedPersonIds,
}: SeriesDetailsContentProps) => {
  const director = seriesCredits?.crew?.find(
    (crew) => crew.job === 'Director'
  )?.name
  return (
    <>
      <section className="container max-w-(--breakpoint-2xl) pt-8 pb-6 sm:pt-12 lg:pb-10">
        {/* flex-col (not -reverse) + order: below `md` the stack must read
            synopsis → poster → episodes, because flex-col-reverse put the
            season navigator ABOVE the h1 — the page's only heading sat under
            a season <Select> on every phone. `order-0` at md restores DOM
            order for the row layout. */}
        <div className={cn(DETAILS_ROW, 'flex-col')}>
          <DetailsPoster
            path={series.poster_path}
            alt={series.name}
            className="order-2 md:order-0"
          />
          <section className="order-1 flex min-w-0 flex-1 flex-col gap-4 md:order-0">
            <SeriesDetailsExtraInfo series={series} director={director} />
            <DetailsCredits
              movieCredits={seriesCredits}
              linkedPersonIds={linkedPersonIds}
            />
          </section>
          {/* Own Suspense boundary: the selector reads ?season during render,
              and without this the bailout would take the entire page
              client-side. Own ERROR boundary too — episode lists load per
              season through a Server Action, and a failure there should not
              take the synopsis, cast, and rails down with it. */}
          <SectionErrorBoundary
            section="series_seasons"
            title="Episodes didn't load"
            className="order-3 md:order-0"
          >
            <Suspense fallback={<SeasonNavigatorFallback />}>
              <SeasonNavigator series={series} />
            </Suspense>
          </SectionErrorBoundary>
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
