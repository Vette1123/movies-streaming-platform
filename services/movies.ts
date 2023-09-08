import { toast } from 'sonner'

import { MovieDetails } from '@/types/movie-details'
import { MovieResponse, MultiRequestProps, Param } from '@/types/movie-result'
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
  const url = `movie/${movieType.popular}?language=en-US`
  return fetchClient.get<MovieResponse>(url, params, true)
}

const populateHomePageData = async (): Promise<MultiRequestProps> => {
  try {
    const [
      nowPlayingResponse,
      latestTrendingResponse,
      popularResponse,
      allTimeTopRatedResponse,
    ] = await Promise.all([
      getNowPlayingMovies(),
      getLatestTrendingMovies(),
      getPopularMovies(),
      getAllTimeTopRatedMovies(),
    ])

    return {
      nowPlayingMovies: nowPlayingResponse?.results || [],
      latestTrendingMovies: latestTrendingResponse?.results || [],
      popularMovies: popularResponse?.results || [],
      allTimeTopRatedMovies: allTimeTopRatedResponse?.results || [],
    }
  } catch (error: any) {
    console.error(error, 'error')
    toast.error(error.message)
    throw new Error(error)
  }
}

const getMovieDetailsById = async (id: string, params: Param = {}) => {
  const url = `movie/${id}?language=en-US`
  return fetchClient.get<MovieDetails>(url, params, true)
}

export {
  getNowPlayingMovies,
  getLatestTrendingMovies,
  getAllTimeTopRatedMovies,
  getPopularMovies,
  populateHomePageData,
  getMovieDetailsById,
}
