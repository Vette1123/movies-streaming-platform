import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
  getPopularSeries,
  getSeriesDetailsById,
  populateSeriesDetailsPageData,
} from '@/services/series'

import { PageDetailsProps } from '@/types/page-details'
import { siteConfig } from '@/config/site'
import { buildDetailsOgImages, buildMediaStaticParams } from '@/lib/media-page'
import { breadcrumbJsonLd, JsonLd, tvSeriesJsonLd } from '@/lib/structured-data'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import { SeriesDetailsContent } from '@/components/series/details-content'
import { SeriesDetailsHero } from '@/components/series/details-hero'

// 24h: series metadata is essentially static and CI redeploys twice daily
// (repopulating the cache with fresh data), so a shorter window would only
// churn KV writes against the free-plan 1k/day cap for no freshness gain.
export const revalidate = 86400

// Pre-render the most popular series pages at build time so they ship as static
// assets (served by the ASSETS binding — zero Worker CPU, even on an edge-cache
// miss). `dynamicParams` stays true, so any non-prebuilt id still renders on
// demand and gets edge-cached. Fail-soft to [] so a TMDB hiccup at build never
// breaks the deploy (empty list = current all-dynamic behaviour, no regression).
export const dynamicParams = true

export function generateStaticParams() {
  return buildMediaStaticParams({
    popular: getPopularSeries,
    topRated: getAllTimeTopRatedSeries,
    trending: getLatestTrendingSeries,
  })
}

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
  const title = year ? `${seriesDetails.name} (${year})` : seriesDetails.name
  const description =
    seriesDetails.overview?.slice(0, 200) ||
    `Details, cast, and streaming info for ${seriesDetails.name} on ${siteConfig.name}.`
  const canonicalPath = `/tv-shows/${id}`
  const images = buildDetailsOgImages(
    seriesDetails.backdrop_path,
    seriesDetails.poster_path,
    seriesDetails.name
  )

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
  const {
    seriesDetails,
    seriesCredits,
    similarSeries,
    recommendedSeries,
    trailerKey,
  } = result!
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
      <SeriesDetailsHero series={seriesDetails} trailerKey={trailerKey} />
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
