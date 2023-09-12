import { Movie } from '@/types/movie-result'

type MediaType = Movie

interface MediaResponse {
  page: number
  results: MediaType[]
}

export type { MediaType, MediaResponse }
