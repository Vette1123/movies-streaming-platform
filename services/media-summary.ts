import { cache } from 'react'

import { fetchClient } from '@/lib/fetch-client'

// The handful of fields needed to describe a title, and nothing else.
//
// The tail-id fallback in cloudflare/worker.js writes a <title>, a description,
// OG/Twitter tags, JSON-LD and a crawlable <h1>. That is six fields. It used to
// get them from populateMovieDetailsPage, which fetches
// `append_to_response=credits,similar,recommendations,videos` — 98KB for a
// movie, ~49KB for a series — and then maps cast lists and two rails it throws
// away. Measured on the live Worker at 3-6ms of CPU per request against a
// 10ms budget.
//
// A plain detail fetch is 1.7KB for that same movie. The client shell still
// asks /api/media/:id for the full payload once it boots; that request needs
// everything and is cached separately. This is only about what the Worker has
// to parse before it can stream the HTML.
export interface MediaSummary {
  id: number
  title?: string
  name?: string
  overview?: string
  release_date?: string
  first_air_date?: string
  backdrop_path?: string | null
  poster_path?: string | null
  // Rides along on the same plain detail response — no extra request. The
  // fallback's meta description spends its leftover budget on these when the
  // title's overview is a single line (lib/seo-description.ts).
  genres?: { id: number; name: string }[]

  // Everything below is in that same 1.7KB response and was simply going
  // unread. lib/seo-facts.ts turns it into the body copy a tail page needs to
  // stop reading like an empty template — see the note there. Declaring a
  // field here costs nothing: the request itself does not change.
  tagline?: string
  status?: string
  original_language?: string
  original_title?: string
  original_name?: string
  spoken_languages?: { iso_639_1: string; english_name: string }[]
  production_companies?: { id: number; name: string }[]
  production_countries?: { iso_3166_1: string; name: string }[]
  vote_average?: number
  vote_count?: number
  belongs_to_collection?: { id: number; name?: string } | null
  // Movies only.
  runtime?: number | null
  // Series only.
  last_air_date?: string
  in_production?: boolean
  number_of_seasons?: number
  number_of_episodes?: number
  episode_run_time?: number[]
  networks?: { id: number; name: string }[]
  created_by?: { id: number; name: string }[]
}

export const getMediaSummary = cache(
  async (type: 'movie' | 'tv', id: string): Promise<MediaSummary> =>
    fetchClient.get<MediaSummary>(`${type}/${id}?language=en-US`, {}, true)
)
