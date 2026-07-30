import React, { Suspense } from 'react'

import { Credit } from '@/types/credit'
import { MediaType } from '@/types/media'
import { SeriesDetails } from '@/types/series-details'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { DetailsCredits } from '@/components/media/details-credits'
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
}

export const SeriesDetailsContent = ({
  series,
  seriesCredits,
  similarSeries,
  recommendedSeries,
}: SeriesDetailsContentProps) => {
  const director = seriesCredits?.crew?.find(
    (crew) => crew.job === 'Director'
  )?.name
  return (
    <>
      <section className="container max-w-(--breakpoint-2xl) pt-12 pb-6 lg:pb-10">
        <div className="flex flex-col-reverse gap-8 lg:flex-row">
          <div className="mx-auto w-full max-w-[220px] shrink-0 sm:max-w-[260px] lg:mx-0 lg:w-[400px] lg:max-w-none">
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-xl lg:aspect-auto lg:min-h-[600px]">
              <BlurredImage
                src={getPosterImageURL(series.poster_path)}
                alt={series.name}
                className="h-full w-full object-cover"
                fill
                sizes="(min-width: 1024px) 400px, 260px"
                intro
              />
            </div>
          </div>
          <section className="flex flex-1 flex-col gap-4">
            <SeriesDetailsExtraInfo series={series} director={director} />
            <DetailsCredits movieCredits={seriesCredits} />
          </section>
          {/* Own Suspense boundary: the selector reads ?season during render,
              and without this the bailout would take the entire page
              client-side. Own ERROR boundary too — episode lists load per
              season through a Server Action, and a failure there should not
              take the synopsis, cast, and rails down with it. */}
          <SectionErrorBoundary
            section="series_seasons"
            title="Episodes didn't load"
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
            title="Recommended Series"
            items={recommendedSeries}
            itemType="tv"
          />
        </Suspense>
        <Suspense fallback={<SliderHorizontalListLoader />}>
          <List title="Similar Series" items={similarSeries} itemType="tv" />
        </Suspense>
      </div>
    </>
  )
}
