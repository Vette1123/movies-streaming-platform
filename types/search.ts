import { Movie } from '@/types/movie-result'
import { Series } from '@/types/series-result'

type SearchResponse = {
  page: number
  results: (Series & Movie)[]
}

export type { SearchResponse }
