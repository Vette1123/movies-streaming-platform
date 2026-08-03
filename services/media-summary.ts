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
}

export const getMediaSummary = cache(
  async (type: 'movie' | 'tv', id: string): Promise<MediaSummary> =>
    fetchClient.get<MediaSummary>(`${type}/${id}?language=en-US`, {}, true)
)
