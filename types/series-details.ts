import { Credit } from '@/types/credit'
import { EpisodeToAir, Network } from '@/types/episode'
import { MediaType } from '@/types/media'
import { MovieGenre } from '@/types/movie-genre'
import { ProductionCompany, ProductionCountry } from '@/types/production'
import { SeriesResponse } from '@/types/series-result'
import { VideosResponse } from '@/types/video'
import type { TmdbWatchProviders } from '@/lib/push/providers'

type Season = {
  air_date: string
  episode_count: number
  id: number
  name: string
  overview: string
  poster_path: string | null
  season_number: number
  vote_average: number
}

type SpokenLanguage = {
  english_name: string
  iso_639_1: string
  name: string
}

interface SeriesDetails {
  adult: boolean
  backdrop_path: string
  created_by: {
    id: number
    credit_id: string
    name: string
    gender: number
    profile_path: string
  }[]
  episode_run_time: number[]
  first_air_date: string
  genres: MovieGenre[]
  homepage: string
  id: number
  imdb_id?: string
  // TV details do not carry imdb_id at the top level — it rides along on
  // external_ids, appended to the same request and kept through the peel in
  // services/series.ts, so the detail page (and the player ticket) can read it.
  external_ids?: { imdb_id?: string | null }
  in_production: boolean
  languages: string[]
  last_air_date: string
  last_episode_to_air: EpisodeToAir | null
  name: string
  next_episode_to_air: EpisodeToAir | null
  networks: Network[]
  number_of_episodes: number
  number_of_seasons: number
  origin_country: string[]
  original_language: string
  original_name: string
  overview: string
  poster_path: string
  production_companies: ProductionCompany[]
  production_countries: ProductionCountry[]
  seasons: Season[]
  spoken_languages: SpokenLanguage[]
  status: string
  tagline: string
  type: string
  vote_average: number
  vote_count: number
  imdbRating?: string | null
}

interface MultiSeriesDetailsRequestProps {
  seriesDetails: SeriesDetails
  seriesCredits: Credit
  similarSeries: MediaType[]
  recommendedSeries: MediaType[]
  // Best YouTube trailer/teaser key, if any (see lib/videos.ts).
  trailerKey?: string
  // That clip's real publish date, for the VideoObject in the page's JSON-LD.
  trailerPublishedAt?: string
  // Where it streams, in ONE region, and only where a page is being rendered —
  // see lib/tmdb-append.ts for why the Worker never fetches this.
}

// Shape of a single `tv/{id}?append_to_response=credits,similar,recommendations,videos`
// call — one TMDB request in place of five. See services/series.ts.
interface SeriesDetailsWithExtras extends SeriesDetails {
  credits?: Credit
  similar?: SeriesResponse
  recommendations?: SeriesResponse
  videos?: VideosResponse
  // TMDB names an appended block after its endpoint path, slash included. Only
  // ever present on a build/dev fetch — see lib/tmdb-append.ts.
  'watch/providers'?: TmdbWatchProviders
}

export type {
  SeriesDetails,
  SeriesDetailsWithExtras,
  MultiSeriesDetailsRequestProps,
  Season,
}
