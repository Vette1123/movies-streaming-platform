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
import { getImdbRating } from '@/services/imdb'

import { fetchClient } from '@/lib/fetch-client'
import { movieType } from '@/lib/tmdbConfig'
import { pickTrailerKey } from '@/lib/videos'

const getNowPlayingMovies = async (params: Param = {}) => {
  const url = `movie/${movieType.now_playing}`
  return fetchClient.get<MovieResponse>(url, params)
}

const getLatestTrendingMovies = async (params: Param = {}) => {
  const url = `${movieType.trending}/movie/day?language=en-US`
  return fetchClient.get<MovieResponse>(url, params, true)
}

const getAllTimeTopRatedMovies = async (params: Param = {}) => {
  const url = `movie/${movieType.top_rated}?language=en-US`
  return fetchClient.get<MovieResponse>(url, params, true)
}
const getPopularMovies = async (params: Param = {}) => {
  'use server'
  const url = `movie/${movieType.popular}?language=en-US`
  return fetchClient.get<MediaResponse>(url, params, true)
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
  try {
    const [
      trendingMediaHeroResponse, // Replaced nowPlayingResponse
      latestTrendingResponse,
      popularMoviesResponse,
      allTimeTopRatedResponse,
      latestTrendingSeries,
      popularSeriesResponse,
      allTimeTopRatedSeries,
    ] = await Promise.all([
      getTrendingMediaForHeroSlider(), // Replaced getNowPlayingMovies()
      getLatestTrendingMovies(),
      getPopularMovies(),
      getAllTimeTopRatedMovies(),
      getLatestTrendingSeries(),
      getPopularSeries(),
      getAllTimeTopRatedSeries(),
    ])

    return {
      trendingMediaForHero: trendingMediaHeroResponse || [], // Changed from nowPlayingMovies
      latestTrendingMovies: latestTrendingResponse?.results || [],
      popularMovies: popularMoviesResponse?.results || [],
      allTimeTopRatedMovies: allTimeTopRatedResponse?.results || [],
      latestTrendingSeries: latestTrendingSeries?.results || [],
      popularSeries: popularSeriesResponse?.results || [],
      allTimeTopRatedSeries: allTimeTopRatedSeries?.results || [],
    }
  } catch (error: any) {
    console.error(error, 'error')
    throw new Error(error)
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
