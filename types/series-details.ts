import { Credit } from '@/types/credit'
import { EpisodeToAir, Network } from '@/types/episode'
import { MediaType } from '@/types/media'
import { MovieGenre } from '@/types/movie-genre'
import { ProductionCompany, ProductionCountry } from '@/types/production'

type Season = {
  air_date: string
  episode_count: number
  id: number
  name: string
  overview: string
  poster_path: string | null
  season_number: number
  vote_average: number
}

type SpokenLanguage = {
  english_name: string
  iso_639_1: string
  name: string
}

interface SeriesDetails {
  adult: boolean
  backdrop_path: string
  created_by: {
    id: number
    credit_id: string
    name: string
    gender: number
    profile_path: string
  }[]
  episode_run_time: number[]
  first_air_date: string
  genres: MovieGenre[]
  homepage: string
  id: number
  in_production: boolean
  languages: string[]
  last_air_date: string
  last_episode_to_air: EpisodeToAir | null
  name: string
  next_episode_to_air: EpisodeToAir | null
  networks: Network[]
  number_of_episodes: number
  number_of_seasons: number
  origin_country: string[]
  original_language: string
  original_name: string
  overview: string
  poster_path: string
  production_companies: ProductionCompany[]
  production_countries: ProductionCountry[]
  seasons: Season[]
  spoken_languages: SpokenLanguage[]
  status: string
  tagline: string
  type: string
  vote_average: number
  vote_count: number
}

interface MultiSeriesDetailsRequestProps {
  seriesDetails: SeriesDetails
  seriesCredits: Credit
  similarSeries: MediaType[]
  recommendedSeries: MediaType[]
}

export type { SeriesDetails, MultiSeriesDetailsRequestProps, Season }
