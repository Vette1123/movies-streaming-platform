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
import { getMediaHeroImageUrl } from '@/lib/media'
import { buildDetailsMetadata, buildMediaStaticParams } from '@/lib/media-page'
import { breadcrumbJsonLd, JsonLd, movieJsonLd } from '@/lib/structured-data'
import { MoviesDetailsContent } from '@/components/media/details-content'
import { MovieDetailsHero } from '@/components/media/details-hero'

// 24h: movie metadata is essentially static and CI redeploys twice daily,
// repopulating the cache with fresh data. A shorter window buys no freshness —
// the incremental cache is read-only (see open-next.config.ts), so an expired
// entry can't be revalidated in place anyway; the redeploy is the refresh.
export const revalidate = 86400

// Pre-render the most popular movie pages at build time so they ship as static
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

  return buildDetailsMetadata({
    id,
    title: movieDetails.title,
    releaseDate: movieDetails.release_date,
    overview: movieDetails.overview,
    backdropPath: movieDetails.backdrop_path,
    posterPath: movieDetails.poster_path,
    genres: movieDetails.genres,
    basePath: '/movies',
    ogType: 'video.movie',
    keywordsTail: ['watch online', 'movie details'],
    ogReleaseDate: movieDetails.release_date || undefined,
  })
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
    imageUrl: getMediaHeroImageUrl(
      movieDetails.backdrop_path,
      movieDetails.poster_path
    ),
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
