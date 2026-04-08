import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import {
  getSeriesDetailsById,
  populateSeriesDetailsPageData,
} from '@/services/series'

import { siteConfig } from '@/config/site'
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

  const seriesDetails = await getSeriesDetailsById(id)

  return {
    title: seriesDetails.name,
    description: seriesDetails.overview,
    openGraph: {
      title: seriesDetails.name,
      description: seriesDetails.overview,
      url: `${siteConfig.websiteURL}/tv-shows/${id}`,
      images: [
        {
          url: getPosterImageURL(seriesDetails?.backdrop_path),
          width: 1280,
          height: 720,
          alt: seriesDetails.name,
        },
        {
          url: getPosterImageURL(seriesDetails?.poster_path),
          width: 500,
          height: 750,
          alt: seriesDetails.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seriesDetails.name,
      description: seriesDetails.overview,
      images: [getPosterImageURL(seriesDetails?.backdrop_path)],
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
