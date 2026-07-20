import { cache } from 'react'
import {
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
  getPopularSeries,
} from '@/services/series'

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
import { attachImdbRatings, getImdbRating } from '@/services/imdb'

import { fetchClient } from '@/lib/fetch-client'
import { movieType } from '@/lib/tmdbConfig'
import { pickTrailerKey } from '@/lib/videos'

const getNowPlayingMovies = async (params: Param = {}) => {
  const url = `movie/${movieType.now_playing}`
  return fetchClient.get<MovieResponse>(url, params)
}

const getLatestTrendingMovies = async (params: Param = {}) => {
  const url = `${movieType.trending}/movie/day?language=en-US`
  const data = await fetchClient.get<MovieResponse>(url, params, true)
  return { ...data, results: await attachImdbRatings(data.results || [], 'movie') }
}

const getAllTimeTopRatedMovies = async (params: Param = {}) => {
  const url = `movie/${movieType.top_rated}?language=en-US`
  const data = await fetchClient.get<MovieResponse>(url, params, true)
  return { ...data, results: await attachImdbRatings(data.results || [], 'movie') }
}
const getPopularMovies = async (params: Param = {}) => {
  'use server'
  const url = `movie/${movieType.popular}?language=en-US`
  const data = await fetchClient.get<MediaResponse>(url, params, true)
  return { ...data, results: await attachImdbRatings(data.results || [], 'movie') }
}

// New function to get trending media (movies and TV shows) for the week
const getTrendingAllWeek = async (page: number = 1, params: Param = {}) => {
  const url = `trending/all/week?language=en-US&page=${page}`
  return fetchClient.get<MovieResponse>(url, params, true) // Assuming MovieResponse can handle mixed media types if structured similarly
}

// New function to get 40 trending items (2 pages)
const getTrendingMediaForHeroSlider = async (
  params: Param = {}
): Promise<Movie[]> => {
  try {
    const [page1Response, page2Response] = await Promise.all([
      getTrendingAllWeek(1, params),
      getTrendingAllWeek(2, params),
    ])

    const combinedResults = [
      ...(page1Response?.results || []),
      ...(page2Response?.results || []),
    ]

    return combinedResults // Ensure we only take up to 40 items
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
  return {
    trendingMediaForHero: value(trendingMediaHeroResult) || [],
    latestTrendingMovies: value(latestTrendingResult)?.results || [],
    popularMovies: value(popularMoviesResult)?.results || [],
    allTimeTopRatedMovies: value(allTimeTopRatedResult)?.results || [],
    latestTrendingSeries: value(latestTrendingSeriesResult)?.results || [],
    popularSeries: value(popularSeriesResult)?.results || [],
    allTimeTopRatedSeries: value(allTimeTopRatedSeriesResult)?.results || [],
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

// Carousels are horizontal scrollers — 12 items is plenty and trims server-side
// render work vs. TMDB's full 20-item page.
const RELATED_LIMIT = 12

const populateMovieDetailsPage = async (
  id: string
): Promise<MultiMovieDetailsRequestProps> => {
  try {
    const data = await getMovieWithExtras(id)
    if (!data?.id) throw new Error('Movie not found')
    return {
      movieDetails: { ...data, imdbRating: await getImdbRating(data.imdb_id) },
      movieCredits: data.credits ?? { id: data.id, cast: [], crew: [] },
      similarMovies: (data.similar?.results ?? []).slice(0, RELATED_LIMIT),
      recommendedMovies: (data.recommendations?.results ?? []).slice(
        0,
        RELATED_LIMIT
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
  populateMovieDetailsPage,
}
