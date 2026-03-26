import React, { Suspense } from 'react'

import { Credit } from '@/types/credit'
import { MediaType } from '@/types/media'
import { SeriesDetails } from '@/types/series-details'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { DetailsCredits } from '@/components/media/details-credits'
import { SeriesDetailsExtraInfo } from '@/components/series/details-extra-info'
import { SeasonNavigator } from '@/components/series/season-navigator'

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
    <section className="container max-w-(--breakpoint-2xl) pb-10 pt-10 lg:pb-24">
      {/* Poster — mobile only */}
      <div className="mb-6 flex justify-center lg:hidden">
        <div className="relative h-[210px] w-[140px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
          <BlurredImage
            src={getPosterImageURL(series.poster_path)}
            alt={series.name}
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
              src={getPosterImageURL(series.poster_path)}
              alt={series.name}
              className="size-full object-cover"
              fill
              sizes="360px"
              intro
            />
          </div>
        </div>

        {/* Info + cast + season navigator */}
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <SeriesDetailsExtraInfo series={series} director={director} />
          <div className="border-t border-white/10 pt-6">
            <DetailsCredits movieCredits={seriesCredits} />
          </div>
          <div className="border-t border-white/10 pt-6">
            <SeasonNavigator series={series} />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendedSeries.length > 0 && (
        <div className="mt-12 border-t border-white/10 pt-8">
          <Suspense fallback={<SliderHorizontalListLoader />}>
            <List title="Recommended" items={recommendedSeries} itemType="tv" />
          </Suspense>
        </div>
      )}
      {similarSeries.length > 0 && (
        <div className="mt-4">
          <Suspense fallback={<SliderHorizontalListLoader />}>
            <List title="More Like This" items={similarSeries} itemType="tv" />
          </Suspense>
        </div>
      )}
    </section>
  )
}
