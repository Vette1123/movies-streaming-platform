import { MovieResponse } from '@/types/movie-result'
import { axiosClient } from '@/lib/axios-client'
import { fetchClient } from '@/lib/fetch-client'
import { movieType } from '@/lib/tmdbConfig'

// example for making api call using axios
const getLatestPopularMoviesAxios = async () => {
  const url = `movie/${movieType.now_playing}`
  return axiosClient.get<any, MovieResponse>(url)
}

// making the api call using fetch
const getLatestPopularMovies = async () => {
  const url = `movie/${movieType.now_playing}`
  return fetchClient.get<MovieResponse>(url)
}

export { getLatestPopularMovies }
