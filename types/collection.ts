import { Movie } from '@/types/movie-result'

// TMDB `collection/{id}` payload. `parts` is the franchise's movie list (same
// shape as a discover/list item), which we render with the standard Card grid.
export interface CollectionDetails {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  parts: Movie[]
}
