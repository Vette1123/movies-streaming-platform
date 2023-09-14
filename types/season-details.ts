import { EpisodeDetails } from '@/types/episode'

interface SeasonDetails {
  _id: string
  air_date: string
  episodes: EpisodeDetails[]
  name: string
  overview: string
  id: number
  poster_path: string
  season_number: number
  vote_average: number
}

export type { SeasonDetails }
