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
    <section className="container max-w-(--breakpoint-2xl) pb-10 pt-12 lg:pb-20">
      <div className="flex flex-col-reverse gap-8 lg:flex-row">
        <div className="hidden lg:block">
          <div className="relative min-h-[600px] w-[400px]">
            <BlurredImage
              src={getPosterImageURL(series.poster_path)}
              alt={series.name}
              className="h-full w-full rounded-lg object-fill shadow-lg lg:object-cover"
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              intro
            />
          </div>
        </div>
        <section className="flex flex-1 flex-col gap-4">
          <SeriesDetailsExtraInfo series={series} director={director} />
          <DetailsCredits movieCredits={seriesCredits} />
        </section>
        <SeasonNavigator series={series} />
      </div>
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
    </section>
  )
}
