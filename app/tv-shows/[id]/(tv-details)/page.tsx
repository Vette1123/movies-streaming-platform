import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getSeriesDetailsById,
  populateSeriesDetailsPageData,
} from '@/services/series'

import { siteConfig } from '@/config/site'
import { PageDetailsProps } from '@/types/page-details'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import {
  breadcrumbJsonLd,
  JsonLd,
  tvSeriesJsonLd,
} from '@/lib/structured-data'
import { SeriesDetailsContent } from '@/components/series/details-content'
import { SeriesDetailsHero } from '@/components/series/details-hero'

export const revalidate = 28800

export async function generateMetadata(
  props: PageDetailsProps
): Promise<Metadata> {
  const params = await props.params
  const id = params.id

  let seriesDetails
  try {
    seriesDetails = await getSeriesDetailsById(id)
  } catch {
    notFound()
  }
  if (!seriesDetails?.id) notFound()

  const year = seriesDetails.first_air_date?.slice(0, 4)
  const title = year
    ? `${seriesDetails.name} (${year})`
    : seriesDetails.name
  const description =
    seriesDetails.overview?.slice(0, 200) ||
    `Details, cast, and streaming info for ${seriesDetails.name} on ${siteConfig.name}.`
  const canonicalPath = `/tv-shows/${id}`
  const backdrop = seriesDetails.backdrop_path
    ? getImageURL(seriesDetails.backdrop_path)
    : undefined
  const poster = seriesDetails.poster_path
    ? getPosterImageURL(seriesDetails.poster_path)
    : undefined

  const images = [
    backdrop && {
      url: backdrop,
      width: 1280,
      height: 720,
      alt: seriesDetails.name,
    },
    poster && {
      url: poster,
      width: 500,
      height: 750,
      alt: seriesDetails.name,
    },
  ].filter(Boolean) as Array<{ url: string; width: number; height: number; alt: string }>

  return {
    title,
    description,
    keywords: [
      seriesDetails.name,
      ...(seriesDetails.genres?.map((g) => g.name) ?? []),
      'tv series',
      'episodes',
      'cast',
      'streaming',
      siteConfig.name,
    ],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: 'video.tv_show',
      title,
      description,
      url: `${siteConfig.websiteURL}${canonicalPath}`,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((i) => i.url),
    },
  }
}

const TVSeries = async (props: PageDetailsProps) => {
  const params = await props.params
  let result
  try {
    result = await populateSeriesDetailsPageData(params?.id)
  } catch {
    notFound()
  }
  const { seriesDetails, seriesCredits, similarSeries, recommendedSeries } =
    result!
  if (!seriesDetails?.id) notFound()

  const jsonLd = tvSeriesJsonLd({
    id: seriesDetails.id,
    name: seriesDetails.name,
    description: seriesDetails.overview,
    firstAirDate: seriesDetails.first_air_date,
    lastAirDate: seriesDetails.last_air_date,
    numberOfSeasons: seriesDetails.number_of_seasons,
    numberOfEpisodes: seriesDetails.number_of_episodes,
    genres: seriesDetails.genres?.map((g) => g.name),
    imageUrl: seriesDetails.backdrop_path
      ? getImageURL(seriesDetails.backdrop_path)
      : seriesDetails.poster_path
        ? getPosterImageURL(seriesDetails.poster_path)
        : null,
    voteAverage: seriesDetails.vote_average,
    voteCount: seriesDetails.vote_count,
    tagline: seriesDetails.tagline,
  })

  return (
    <header className="relative">
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'TV Shows', url: '/tv-shows' },
          { name: seriesDetails.name, url: `/tv-shows/${seriesDetails.id}` },
        ])}
      />
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
