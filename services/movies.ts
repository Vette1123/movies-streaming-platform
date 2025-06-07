import {
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
  getPopularSeries,
} from '@/services/series'

import { Credit } from '@/types/credit'
import { MediaResponse } from '@/types/media'
import {
  MovieDetails,
  MultiMovieDetailsRequestProps,
} from '@/types/movie-details'
import {
  Movie,
  MovieResponse,
  MultiRequestProps,
  Param,
} from '@/types/movie-result'
import { fetchClient } from '@/lib/fetch-client'
import { movieType } from '@/lib/tmdbConfig'

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

const getMovieDetailsById = async (id: string, params: Param = {}) => {
  const url = `movie/${id}?language=en-US`
  return fetchClient.get<MovieDetails>(url, params, true)
}

const getMovieCreditsById = async (id: string, params: Param = {}) => {
  const url = `movie/${id}/credits?language=en-US`
  return fetchClient.get<Credit>(url, params, true)
}

const getSimilarMoviesById = async (id: string, params: Param = {}) => {
  const url = `movie/${id}/similar?language=en-US`
  return fetchClient.get<MovieResponse>(url, params, true)
}

const getRecommendedMoviesById = async (id: string, params: Param = {}) => {
  const url = `movie/${id}/recommendations?language=en-US`
  return fetchClient.get<MovieResponse>(url, params, true)
}

const populateMovieDetailsPage = async (
  id: string
): Promise<MultiMovieDetailsRequestProps> => {
  try {
    const [movieDetails, movieCredits, similarMovies, recommendedMovies] =
      await Promise.all([
        getMovieDetailsById(id),
        getMovieCreditsById(id),
        getSimilarMoviesById(id),
        getRecommendedMoviesById(id),
      ])
    return {
      movieDetails,
      movieCredits,
      similarMovies: similarMovies?.results || [],
      recommendedMovies: recommendedMovies?.results || [],
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
  getMovieCreditsById,
  populateMovieDetailsPage,
  getTrendingMediaForHeroSlider, // Export the new function
}
