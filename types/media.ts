import { Movie } from '@/types/movie-result'

type MediaType = Movie

interface MediaResponse {
  page: number
  results: MediaType[]
  total_pages?: number
  total_results?: number
}

export type { MediaType, MediaResponse }
