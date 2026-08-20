import { Credit } from '@/types/credit'
import { MovieGenre } from '@/types/movie-genre'
import { Movie, MovieResponse } from '@/types/movie-result'
import { VideosResponse } from '@/types/video'
import type { TmdbWatchProviders } from '@/lib/push/providers'

interface MovieDetails {
  adult: boolean
  backdrop_path: string
  belongs_to_collection: {
    id: number
    name: string
    poster_path: string
    backdrop_path: string
  }
  budget: number
  genres: MovieGenre[]
  homepage: string
  id: number
  imdb_id: string
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string
  production_companies: {
    id: number
    logo_path: string
    name: string
    origin_country: string
  }[]
  production_countries: {
    iso_3166_1: string
    name: string
  }[]
  release_date: string
  revenue: number
  runtime: number
  spoken_languages: {
    english_name: string
    iso_639_1: string
    name: string
  }[]
  status: string
  tagline: string
  title: string
  video: boolean
  vote_average: number
  vote_count: number
  imdbRating?: string | null
}

interface MultiMovieDetailsRequestProps {
  movieDetails: MovieDetails
  movieCredits: Credit
  similarMovies: Movie[]
  recommendedMovies: Movie[]
  // Best YouTube trailer/teaser key, if any (see lib/videos.ts).
  trailerKey?: string
  // That clip's real publish date, for the VideoObject in the page's JSON-LD.
  trailerPublishedAt?: string
  // Where it streams, in ONE region, and only where a page is being rendered —
  // see lib/tmdb-append.ts for why the Worker never fetches this.
}

// Shape of a single `movie/{id}?append_to_response=credits,similar,recommendations,videos`
// call — one TMDB request in place of five. See services/movies.ts.
interface MovieDetailsWithExtras extends MovieDetails {
  credits?: Credit
  similar?: MovieResponse
  recommendations?: MovieResponse
  videos?: VideosResponse
  // TMDB names an appended block after its endpoint path, slash included. Only
  // ever present on a build/dev fetch — see lib/tmdb-append.ts.
  'watch/providers'?: TmdbWatchProviders
}

export type {
  MovieDetails,
  MovieDetailsWithExtras,
  MultiMovieDetailsRequestProps,
}
