import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getAllTimeTopRatedMovies,
  getLatestTrendingMovies,
  getMovieDetailsById,
  getPopularMovies,
  populateMovieDetailsPage,
} from '@/services/movies'

import { PageDetailsProps } from '@/types/page-details'
import { siteConfig } from '@/config/site'
import { buildDetailsOgImages, buildMediaStaticParams } from '@/lib/media-page'
import { breadcrumbJsonLd, JsonLd, movieJsonLd } from '@/lib/structured-data'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import { MoviesDetailsContent } from '@/components/media/details-content'
import { MovieDetailsHero } from '@/components/media/details-hero'

// 24h: movie metadata is essentially static and CI redeploys twice daily
// (repopulating the cache with fresh data), so a shorter window would only
// churn KV writes against the free-plan 1k/day cap for no freshness gain.
export const revalidate = 86400

// Pre-render the most popular movie pages at build time so they ship as static
// assets (served by the ASSETS binding — zero Worker CPU, even on an edge-cache
// miss). `dynamicParams` stays true, so any non-prebuilt id still renders on
// demand and gets edge-cached. Fail-soft to [] so a TMDB hiccup at build never
// breaks the deploy (empty list = current all-dynamic behaviour, no regression).
export const dynamicParams = true

export function generateStaticParams() {
  return buildMediaStaticParams({
    popular: getPopularMovies,
    topRated: getAllTimeTopRatedMovies,
    trending: getLatestTrendingMovies,
  })
}

export async function generateMetadata(
  props: PageDetailsProps
): Promise<Metadata> {
  const params = await props.params
  const id = params.id

  let movieDetails
  try {
    movieDetails = await getMovieDetailsById(id)
  } catch {
    notFound()
  }
  if (!movieDetails?.id) notFound()

  const year = movieDetails.release_date?.slice(0, 4)
  const title = year ? `${movieDetails.title} (${year})` : movieDetails.title
  const description =
    movieDetails.overview?.slice(0, 200) ||
    `Details, cast, and streaming info for ${movieDetails.title} on ${siteConfig.name}.`
  const canonicalPath = `/movies/${id}`
  const images = buildDetailsOgImages(
    movieDetails.backdrop_path,
    movieDetails.poster_path,
    movieDetails.title
  )

  return {
    title,
    description,
    keywords: [
      movieDetails.title,
      ...(movieDetails.genres?.map((g) => g.name) ?? []),
      'watch online',
      'movie details',
      'cast',
      'streaming',
      siteConfig.name,
    ],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: 'video.movie',
      title,
      description,
      url: `${siteConfig.websiteURL}${canonicalPath}`,
      images,
      releaseDate: movieDetails.release_date || undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((i) => i.url),
    },
  }
}

const MoviePage = async (props: PageDetailsProps) => {
  const params = await props.params
  let result
  try {
    result = await populateMovieDetailsPage(params?.id)
  } catch {
    notFound()
  }
  const {
    movieCredits,
    movieDetails,
    similarMovies,
    recommendedMovies,
    trailerKey,
  } = result!
  if (!movieDetails?.id) notFound()

  const jsonLd = movieJsonLd({
    id: movieDetails.id,
    title: movieDetails.title,
    description: movieDetails.overview,
    releaseDate: movieDetails.release_date,
    runtime: movieDetails.runtime,
    genres: movieDetails.genres?.map((g) => g.name),
    imageUrl: movieDetails.backdrop_path
      ? getImageURL(movieDetails.backdrop_path)
      : movieDetails.poster_path
        ? getPosterImageURL(movieDetails.poster_path)
        : null,
    voteAverage: movieDetails.vote_average,
    voteCount: movieDetails.vote_count,
    tagline: movieDetails.tagline,
  })

  return (
    <header className="relative">
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Movies', url: '/movies' },
          { name: movieDetails.title, url: `/movies/${movieDetails.id}` },
        ])}
      />
      <MovieDetailsHero movie={movieDetails} trailerKey={trailerKey} />
      <MoviesDetailsContent
        movie={movieDetails}
        movieCredits={movieCredits}
        similarMovies={similarMovies}
        recommendedMovies={recommendedMovies}
      />
    </header>
  )
}

export default MoviePage
