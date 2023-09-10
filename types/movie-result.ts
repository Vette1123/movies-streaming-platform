import { MediaResponse, Series } from '@/types/series-result'

type Movie = {
  adult: boolean
  backdrop_path: string
  genre_ids: number[]
  id: number
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string
  release_date: string
  title: string
  video: boolean
  vote_average: number
  vote_count: number
}

interface MovieResponse {
  page: number
  results: Movie[]
}

type Param = Record<string, string | number>

type ItemType = 'movie' | 'tv'

interface MultiRequestProps {
  nowPlayingMovies: Movie[]
  latestTrendingMovies: Movie[]
  popularMovies: Movie[]
  allTimeTopRatedMovies: Movie[]
  latestTrendingSeries: Series[]
  popularSeries: Series[]
  allTimeTopRatedSeries: Series[]
}

type PopularMediaAction<T> = (params?: Param) => Promise<T>

export type {
  Movie,
  MovieResponse,
  Param,
  MultiRequestProps,
  ItemType,
  PopularMediaAction,
}
