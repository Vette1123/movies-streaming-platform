import { ItemType } from '@/types/movie-result'

type Series = {
  adult: boolean
  backdrop_path: string
  id: number
  name: string
  original_language: string
  original_name: string
  overview: string
  poster_path: string
  media_type: ItemType
  genre_ids: number[]
  popularity: number
  first_air_date: string
  vote_average: number
  vote_count: number
  origin_country: string[]
}

interface SeriesResponse {
  page: number
  results: Series[]
}

export type { Series, SeriesResponse }
