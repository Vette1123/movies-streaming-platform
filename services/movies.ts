import { cache } from 'react'
import { attachImdbRatings, getImdbRating } from '@/services/imdb'
import {
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
  getPopularSeries,
} from '@/services/series'

import { CollectionDetails } from '@/types/collection'
import { MediaResponse } from '@/types/media'
import {
  MovieDetailsWithExtras,
  MultiMovieDetailsRequestProps,
} from '@/types/movie-details'
import {
  Movie,
  MovieResponse,
  MultiRequestProps,
  Param,
} from '@/types/movie-result'
import { RAIL_LIMIT } from '@/lib/constants'
import { fetchClient } from '@/lib/fetch-client'
import { capListOverviews } from '@/lib/media'
import { movieType } from '@/lib/tmdbConfig'
import { pickTrailerKey } from '@/lib/videos'

const getNowPlayingMovies = async (params: Param = {}) => {
  const url = `movie/${movieType.now_playing}`
  return fetchClient.get<MovieResponse>(url, params)
}

// Every movie list finishes the same two steps: attach IMDb ratings (a no-op
// while the flag is off) and cap each overview to what a card can actually
// render. Kept in one place so a new list can't ship TMDB's untrimmed 900-char
// synopsis by omission.
const listResponse = async <T extends { results?: Movie[] }>(data: T) => ({
  ...data,
  results: capListOverviews(
    await attachImdbRatings(data.results || [], 'movie')
  ),
})

const getLatestTrendingMovies = async (params: Param = {}) => {
  const url = `${movieType.trending}/movie/day?language=en-US`
  // revalidate:false → build-only; the homepage/list pages that use this are
  // fully static and refresh on the 2x/day deploy (see fetch-client.ts).
  const data = await fetchClient.get<MovieResponse>(url, params, true, false)
  return listResponse(data)
}

const getAllTimeTopRatedMovies = async (params: Param = {}) => {
  const url = `movie/${movieType.top_rated}?language=en-US`
  const data = await fetchClient.get<MovieResponse>(url, params, true, false)
  return listResponse(data)
}
const getPopularMovies = async (params: Param = {}) => {
  'use server'
  const url = `movie/${movieType.popular}?language=en-US`
  const data = await fetchClient.get<MediaResponse>(url, params, true, false)
  return listResponse(data)
}

// New function to get trending media (movies and TV shows) for the week
const getTrendingAllWeek = async (page: number = 1, params: Param = {}) => {
  const url = `trending/all/week?language=en-US&page=${page}`
  // revalidate:false → build-only (hero slider is on the fully static homepage).
  return fetchClient.get<MovieResponse>(url, params, true, false)
}

// One TMDB page — 20 slides. It used to pull two pages for 40, which nobody
// swipes through: the carousel renders a 3-slide window, but EVERY slide's full
// TMDB object is serialized into the RSC flight payload regardless, and each one
// carries an overview, genre list and the rest. Halving the count is a straight
// cut to homepage weight for slides a visitor was never going to reach, and it
// drops a build-time TMDB request too.
const getTrendingMediaForHeroSlider = async (
  params: Param = {}
): Promise<Movie[]> => {
  try {
    const response = await getTrendingAllWeek(1, params)
    // The hero line-clamps to 3 lines, so the rest of a TMDB synopsis is pure
    // payload — and at 20 slides that adds up. Same cap the cards use.
    return capListOverviews(response?.results || [])
  } catch (error) {
    console.error('Error fetching trending media for hero slider:', error)
    return [] // Return empty array or throw error as per desired error handling
  }
}

const populateHomePageData = async (): Promise<MultiRequestProps> => {
  // allSettled, NOT all: the homepage is statically built (see
  // app/(landing)/page.tsx), so a single flaky TMDB list must NOT throw and fail
  // the whole deploy — it degrades to an empty row and the page still ships. The
  // old `Promise.all` + `throw` turned one transient TMDB hiccup into a failed
  // build (or, back when this rendered live, a 500).
  const [
    trendingMediaHeroResult,
    latestTrendingResult,
    popularMoviesResult,
    allTimeTopRatedResult,
    latestTrendingSeriesResult,
    popularSeriesResult,
    allTimeTopRatedSeriesResult,
  ] = await Promise.allSettled([
    getTrendingMediaForHeroSlider(),
    getLatestTrendingMovies(),
    getPopularMovies(),
    getAllTimeTopRatedMovies(),
    getLatestTrendingSeries(),
    getPopularSeries(),
    getAllTimeTopRatedSeries(),
  ])

  const value = <T>(r: PromiseSettledResult<T>): T | undefined => {
    if (r.status === 'fulfilled') return r.value
    console.error('populateHomePageData: a list failed', r.reason)
    return undefined
  }

  // Rows arrive already IMDb-enriched from the source list fetches, so the
  // homepage just forwards them. The hero keeps its own IMDb-or-star path.
  //
  // Each row is capped at RAIL_LIMIT rather than shipping TMDB's full 20: the
  // rails are horizontal scrollers that 12 items already fill, and the items
  // past that cost markup plus a second copy of themselves in the RSC flight
  // payload. Same cap the detail-page rails use.
  const rail = (r: PromiseSettledResult<{ results?: Movie[] } | undefined>) =>
    (value(r)?.results || []).slice(0, RAIL_LIMIT)

  return {
    trendingMediaForHero: value(trendingMediaHeroResult) || [],
    latestTrendingMovies: rail(latestTrendingResult),
    popularMovies: rail(popularMoviesResult),
    allTimeTopRatedMovies: rail(allTimeTopRatedResult),
    latestTrendingSeries: rail(latestTrendingSeriesResult),
    popularSeries: rail(popularSeriesResult),
    allTimeTopRatedSeries: rail(allTimeTopRatedSeriesResult),
  }
}

// Single TMDB request that returns details + credits + similar +
// recommendations via `append_to_response`, replacing four separate calls. On a
// cold on-demand render (long-tail id not prebuilt) that's ONE KV fetch-cache
// write and ONE JSON parse instead of four — the difference between staying
// under the free-plan 10ms Worker CPU / 1k KV-writes-per-day limits and blowing
// them (Error 1102 / "KV put() limit exceeded"). cache() dedupes it with
// generateMetadata so the whole page renders on a single fetch.
const getMovieWithExtras = cache(async (id: string, params: Param = {}) => {
  // `videos` rides along on the same append_to_response — still ONE TMDB
  // request / one KV write — and powers the "Watch Trailer" CTA.
  const url = `movie/${id}?language=en-US&append_to_response=credits,similar,recommendations,videos`
  return fetchClient.get<MovieDetailsWithExtras>(url, params, true)
})

// Kept for generateMetadata, which only needs the core fields. Delegates to the
// cached combined fetch so metadata + page share a single TMDB request.
const getMovieDetailsById = cache(async (id: string, params: Param = {}) => {
  const movie = await getMovieWithExtras(id, params)
  return {
    ...movie,
    imdbRating: await getImdbRating(movie.imdb_id),
  }
})

// Franchise/collection page (e.g. "Lilo & Stitch Collection"). TMDB ships the
// full movie list in one `collection/{id}` call, so this is a single cached
// request — cheap to render and to prebuild. cache() dedupes it across the
// page's generateMetadata + body.
const getCollectionById = cache(async (id: string, params: Param = {}) => {
  const url = `collection/${id}?language=en-US`
  return fetchClient.get<CollectionDetails>(url, params, true)
})

const populateMovieDetailsPage = async (
  id: string
): Promise<MultiMovieDetailsRequestProps> => {
  try {
    const data = await getMovieWithExtras(id)
    if (!data?.id) throw new Error('Movie not found')
    return {
      movieDetails: { ...data, imdbRating: await getImdbRating(data.imdb_id) },
      movieCredits: data.credits ?? { id: data.id, cast: [], crew: [] },
      similarMovies: (data.similar?.results ?? []).slice(0, RAIL_LIMIT),
      recommendedMovies: (data.recommendations?.results ?? []).slice(
        0,
        RAIL_LIMIT
      ),
      trailerKey: pickTrailerKey(data.videos?.results),
    }
  } catch (error: any) {
    console.error(error, 'error')
    throw new Error(error)
  }
}

export {
  getNowPlayingMovies,
  getLatestTrendingMovies,
  getAllTimeTopRatedMovies,
  getPopularMovies,
  populateHomePageData,
  getMovieDetailsById,
  getCollectionById,
  populateMovieDetailsPage,
}
