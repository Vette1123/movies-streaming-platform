import { Movie } from '@/types/movie-result'

type MediaType = Movie

interface MediaResponse {
  page: number
  results: MediaType[]
  total_pages?: number
  total_results?: number
  /**
   * Set by /api/search when the typed query found nothing and a looser one
   * did — see lib/search-loosen.ts. The picker shows it, because answering a
   * question the visitor did not ask without saying so is how "search is
   * broken" starts.
   */
  matchedQuery?: string
  /** The query was a pasted link, so no search was attempted. */
  pastedUrl?: boolean
}

export type { MediaType, MediaResponse }
