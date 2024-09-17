import { GuestStar } from '@/types/guest'

interface EpisodeToAir {
  id: number
  name: string
  overview: string
  vote_average: number
  vote_count: number
  air_date: string
  episode_number: number
  episode_type: string
  production_code: string
  runtime: number
  season_number: number
  show_id: number
  still_path: string
}

interface Network {
  id: number
  logo_path: string
  name: string
  origin_country: string
}

type Crew = {
  job: string
  department: string
  credit_id: string
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: string | null
}

interface EpisodeDetails {
  air_date: string
  crew: Crew[]
  episode_number: number
  guest_stars: GuestStar[]
  name: string
  overview: string
  show_id: number
  id: number
  production_code: string
  runtime: number
  season_number: number
  still_path: string
  vote_average: number
  vote_count: number
}

export type { EpisodeToAir, Network, EpisodeDetails }
