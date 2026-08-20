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
import { castNames, crewNamesByJob } from '@/lib/credits'
import { getMediaHeroImageUrl } from '@/lib/media'
import { buildDetailsMetadata, buildMediaStaticParams } from '@/lib/media-page'
import { linkablePersonIds } from '@/lib/person-links'
import { breadcrumbJsonLd, JsonLd, movieJsonLd } from '@/lib/structured-data'
import { MoviesDetailsContent } from '@/components/media/details-content'
import { MovieDetailsHero } from '@/components/media/details-hero'

// 24h: movie metadata is essentially static and CI redeploys twice daily,
// repopulating the site with fresh data. A shorter window buys no freshness —
// the site is a static export, so an expired entry can't be revalidated in
// place anyway; the redeploy is the refresh.
export const revalidate = 86400

// Pre-render the most popular movie pages at build time so they ship as static
// assets, matched by Cloudflare BEFORE the Worker is invoked — zero CPU, and not
// even counted against the free plan's request cap.
//
// `dynamicParams` is false because `output: 'export'` requires it. Ids outside
// this set are not lost: cloudflare/worker.js serves them from the exported
// shell with real metadata injected (see the migration spec). That path costs
// one TMDB fetch instead of the 0.4-1.0s React re-render it used to cost on
// EVERY hit — which is what was killing 25-40% of all Worker invocations.
// Fail-soft to [] so a TMDB hiccup at build never breaks the deploy.
export const dynamicParams = false

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
    trailerPublishedAt,
  } = result!
  if (!movieDetails?.id) notFound()

  // Which of this film's cast have a page on this site. Resolved on the
  // server so the client only ever receives the handful that do.
  const linkedPersonIds = await linkablePersonIds(
    (movieCredits?.cast ?? []).slice(0, 10).map((person) => person.id)
  )

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
    cast: castNames(movieCredits),
    directors: crewNamesByJob(movieCredits, 'Director'),
    trailerKey,
    trailerPublishedAt,
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
        linkedPersonIds={linkedPersonIds}
      />
    </header>
  )
}

export default MoviePage
