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
  // Movies carry it on the plain detail response; series need external_ids,
  // which this request does not ask for, so a series is TMDB-only here.
  imdb_id?: string | null
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

  /** Slimmed out of `recommendations` by slimSummary — see below. */
  related?: RelatedTitle[]
}

export interface RelatedTitle {
  id: number
  title: string
  /** YYYY, or empty when TMDB has no date. */
  year: string
}

interface RawRelated {
  id?: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  adult?: boolean
}

type RawSummary = MediaSummary & {
  recommendations?: { results?: RawRelated[] }
}

/** Enough "More like this" links to join a tail page to its neighbours. */
export const RELATED_LIMIT = 8

/**
 * The one exception to "plain detail fetch": `recommendations`.
 *
 * Search Console filed 14,677 tail pages "Crawled - currently not indexed" on
 * 2026-11-12. Each linked out to two genre hubs and no other title, so the
 * ~13,900 tail ids were islands: reachable from the sitemap, linked from
 * nothing. Recommendations come back for obscure titles too (20 for a 2008
 * Bollywood film) and add ~13KB, against the 98KB the full payload costs, so
 * the parse stays well inside the 10ms budget. The raw list is dropped here,
 * before the Worker caches the summary, so a cache hit still parses ~2KB.
 */
export function slimSummary(raw: RawSummary): MediaSummary {
  const { recommendations, ...summary } = raw
  const seen = new Set([raw.id])
  const related: RelatedTitle[] = []
  for (const item of recommendations?.results ?? []) {
    if (related.length === RELATED_LIMIT) break
    const title = (item.title || item.name || '').trim()
    if (!item.id || !title || item.adult || seen.has(item.id)) continue
    seen.add(item.id)
    const date = item.release_date || item.first_air_date || ''
    related.push({ id: item.id, title, year: date.slice(0, 4) })
  }
  return { ...summary, related }
}

export const getMediaSummary = cache(
  async (type: 'movie' | 'tv', id: string): Promise<MediaSummary> =>
    slimSummary(
      await fetchClient.get<RawSummary>(
        `${type}/${id}?language=en-US&append_to_response=recommendations`,
        {},
        true
      )
    )
)
