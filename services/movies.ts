import { MovieResponse } from '@/types/movie-result'
import { axiosClient } from '@/lib/axios-client'
import { movieType } from '@/lib/tmdbConfig'

const getLatestPopularMovies = async () => {
  const url = `movie/${movieType.now_playing}`
  return axiosClient.get<any, MovieResponse>(url)
}

export { getLatestPopularMovies }
