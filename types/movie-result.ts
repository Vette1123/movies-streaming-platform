import { MediaType } from '@/types/media'

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
  media_type?: ItemType
  name?: string
  first_air_date?: string
}

interface MovieResponse {
  page: number
  results: Movie[]
}

type Param = Record<string, string | number>

type ItemType = 'movie' | 'tv'

interface MultiRequestProps {
  trendingMediaForHero: Movie[]
  latestTrendingMovies: Movie[]
  popularMovies: Movie[]
  allTimeTopRatedMovies: Movie[]
  latestTrendingSeries: MediaType[]
  popularSeries: MediaType[]
  allTimeTopRatedSeries: MediaType[]
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
