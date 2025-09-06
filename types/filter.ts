interface FilterParams {
  // Genres
  with_genres?: string
  without_genres?: string

  // Release/Air Date
  'release_date.gte'?: string
  'release_date.lte'?: string
  'first_air_date.gte'?: string
  'first_air_date.lte'?: string

  // Ratings
  'vote_average.gte'?: number
  'vote_average.lte'?: number
  'vote_count.gte'?: number

  // Sort
  sort_by?: SortOption

  // Other filters
  with_runtime_gte?: number
  with_runtime_lte?: number
  include_adult?: boolean
  include_video?: boolean
  with_original_language?: string

  // Common params
  page?: number
  language?: string
}

interface MediaFilter {
  // Genre filters
  selectedGenres: number[]
  excludedGenres: number[]

  // Date filters
  fromDate?: string
  toDate?: string

  // Rating filters
  minRating?: number
  maxRating?: number
  minVotes?: number

  // Runtime filters (for movies)
  minRuntime?: number
  maxRuntime?: number

  // Sort option
  sortBy: SortOption

  // Content filters
  includeAdult: boolean
  originalLanguage?: string
}

type SortOption =
  | 'popularity.desc'
  | 'popularity.asc'
  | 'release_date.desc'
  | 'release_date.asc'
  | 'revenue.desc'
  | 'revenue.asc'
  | 'primary_release_date.desc'
  | 'primary_release_date.asc'
  | 'original_title.asc'
  | 'original_title.desc'
  | 'vote_average.desc'
  | 'vote_average.asc'
  | 'vote_count.desc'
  | 'vote_count.asc'
  | 'first_air_date.desc'
  | 'first_air_date.asc'
  | 'name.asc'
  | 'name.desc'

interface FilterOption {
  label: string
  value: string | number
}

interface FilterSection {
  title: string
  type: 'multiselect' | 'range' | 'select' | 'checkbox' | 'date'
  options?: FilterOption[]
  min?: number
  max?: number
  step?: number
}

export type {
  FilterParams,
  MediaFilter,
  SortOption,
  FilterOption,
  FilterSection,
}
