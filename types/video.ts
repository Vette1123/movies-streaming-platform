// A single entry from TMDB's `videos` append (trailers, teasers, clips…).
export interface Video {
  id: string
  iso_639_1: string
  iso_3166_1: string
  key: string
  name: string
  site: string
  size: number
  type: string
  official: boolean
  published_at: string
}

export interface VideosResponse {
  results: Video[]
}
