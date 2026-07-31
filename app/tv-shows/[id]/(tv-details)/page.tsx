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
import { getMediaHeroImageUrl } from '@/lib/media'
import { buildDetailsMetadata, buildMediaStaticParams } from '@/lib/media-page'
import { breadcrumbJsonLd, JsonLd, tvSeriesJsonLd } from '@/lib/structured-data'
import { SeriesDetailsContent } from '@/components/series/details-content'
import { SeriesDetailsHero } from '@/components/series/details-hero'
import { SeriesPlaybackProvider } from '@/components/series/playback-context'

// 24h: series metadata is essentially static and CI redeploys twice daily,
// repopulating the cache with fresh data. A shorter window buys no freshness —
// the incremental cache is read-only (see open-next.config.ts), so an expired
// entry can't be revalidated in place anyway; the redeploy is the refresh.
export const revalidate = 86400

// Pre-render the most popular series pages at build time so they ship as static
// assets (served by the ASSETS binding — zero Worker CPU). `dynamicParams`
// stays true so any other id still resolves, but that path is EXPENSIVE and does
// not get cheaper on repeat: Cloudflare does not edge-cache Worker-generated
// HTML (no cf-cache-status on these responses), and the read-only incremental
// cache can't store the render, so every hit re-renders on the Worker. Measured
// 0.7-5.4s per render, and crawlers walking TMDB ids this way are what drive the
// free-plan CPU kills — which is why the prerender set is sized to swallow as
// much of the real distribution as a build can afford (lib/media-page.ts).
// Fail-soft to [] so a TMDB hiccup at build never breaks the deploy (empty list
// = all-dynamic behaviour, no regression).
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

  return buildDetailsMetadata({
    id,
    title: seriesDetails.name,
    releaseDate: seriesDetails.first_air_date,
    overview: seriesDetails.overview,
    backdropPath: seriesDetails.backdrop_path,
    posterPath: seriesDetails.poster_path,
    genres: seriesDetails.genres,
    basePath: '/tv-shows',
    ogType: 'video.tv_show',
    keywordsTail: ['tv series', 'episodes'],
  })
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
    imageUrl: getMediaHeroImageUrl(
      seriesDetails.backdrop_path,
      seriesDetails.poster_path
    ),
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
      {/* Client provider around both halves: the episode list asks for
          playback, the hero owns the embed. Server children pass straight
          through, so the page stays server-rendered. */}
      <SeriesPlaybackProvider>
        <SeriesDetailsHero series={seriesDetails} trailerKey={trailerKey} />
        <SeriesDetailsContent
          series={seriesDetails}
          seriesCredits={seriesCredits}
          similarSeries={similarSeries}
          recommendedSeries={recommendedSeries}
        />
      </SeriesPlaybackProvider>
    </header>
  )
}

export default TVSeries
