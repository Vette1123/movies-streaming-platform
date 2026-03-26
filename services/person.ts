import { fetchClient } from '@/lib/fetch-client'

export interface PersonDetails {
  id: number
  name: string
  biography: string
  birthday: string | null
  deathday: string | null
  gender: number
  known_for_department: string
  place_of_birth: string | null
  popularity: number
  profile_path: string | null
  homepage: string | null
  imdb_id: string | null
}

export interface PersonCredit {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  media_type: 'movie' | 'tv'
  release_date?: string
  first_air_date?: string
  vote_average: number
  character?: string
  job?: string
}

export interface PersonCredits {
  cast: PersonCredit[]
  crew: PersonCredit[]
}

export const getPersonDetails = (id: string) =>
  fetchClient.get<PersonDetails>(`person/${id}?language=en-US`, {}, true)

export const getPersonCredits = (id: string) =>
  fetchClient.get<PersonCredits>(
    `person/${id}/combined_credits?language=en-US`,
    {},
    true
  )
