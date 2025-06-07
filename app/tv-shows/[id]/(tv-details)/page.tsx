import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import {
  getSeriesDetailsById,
  populateSeriesDetailsPageData,
} from '@/services/series'

import { PageDetailsProps } from '@/types/page-details'
import { getPosterImageURL } from '@/lib/utils'
import { SeriesDetailsContent } from '@/components/series/details-content'
import { SeriesDetailsHero } from '@/components/series/details-hero'

export async function generateMetadata(
  props: PageDetailsProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await props.params
  // read route params
  const id = params.id

  const movieDetails = await getSeriesDetailsById(id)

  const previousImages = (await parent).openGraph?.images || []

  return {
    title: movieDetails.name,
    description: movieDetails.overview,
    metadataBase: new URL(`/movies/${id}`, process.env.NEXT_PUBLIC_BASE_URL),
    openGraph: {
      images: [
        ...previousImages,
        getPosterImageURL(movieDetails?.poster_path),
        getPosterImageURL(movieDetails?.backdrop_path),
      ],
    },
  }
}

const TVSeries = async (props: PageDetailsProps) => {
  const params = await props.params
  const { seriesDetails, seriesCredits, similarSeries, recommendedSeries } =
    await populateSeriesDetailsPageData(params?.id)

  return (
    <header className="relative">
      <SeriesDetailsHero series={seriesDetails} />
      <SeriesDetailsContent
        series={seriesDetails}
        seriesCredits={seriesCredits}
        similarSeries={similarSeries}
        recommendedSeries={recommendedSeries}
      />
    </header>
  )
}

export default TVSeries
