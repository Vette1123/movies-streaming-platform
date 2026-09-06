import { searchDTO } from '@/dtos/search'
import { getImdbRatingByTmdbId } from '@/services/imdb'

import { Param } from '@/types/movie-result'
import { SearchResponse } from '@/types/search'
import { fetchClient } from '@/lib/fetch-client'
import {
  looksLikeUrl,
  looseningVariants,
  MAX_LOOSENING_ATTEMPTS,
} from '@/lib/search-loosen'

// Multi-search, moved out of actions/search.ts (a Server Action, which a static
// export cannot contain) so cloudflare/worker.js can serve it as /api/search.

/** One TMDB round trip, enriched. The loosening loop below drives it. */
const searchOnce = async (params: Param) => {
  const url = `search/multi?include_adult=false&language=en-US&page=1`
  const rawData = await fetchClient.get<SearchResponse>(url, params, true)
  const dto = searchDTO(rawData)

  // Attach real IMDb scores per result (search/multi mixes movies + TV; people
  // have no rating). A no-op while NEXT_PUBLIC_IMDB_RATINGS is off, and soft-
  // fails to the TMDB average, so a slow lookup never blocks the picker.
  const results = await Promise.all(
    dto.results.map(async (item) => {
      const type = item.media_type
      if (type !== 'movie' && type !== 'tv') return item
      return { ...item, imdbRating: await getImdbRatingByTmdbId(item.id, type) }
    })
  )
  return { ...dto, results }
}

/** Anything the picker will actually draw — people are filtered out there. */
const renderableCount = (results: { media_type?: string }[]): number =>
  results.filter((item) => item?.media_type !== 'person').length

/**
 * Multi-search that does not give up on the first miss.
 *
 * TMDB matches prefixes and nothing else, so `godfathr` returns zero results
 * while `godfath` returns The Godfather. On a miss this retries with the
 * looser queries from `lib/search-loosen.ts`, best-first, and stops at the
 * first that finds something. The extra round trips are spent ONLY on a query
 * that was already going to show an empty list.
 *
 * `matchedQuery` names what actually produced the results, so the picker can
 * say what it did rather than silently answering a different question. It is
 * absent when the original query matched, which is the common case.
 */
export const searchMedia = async (params: Param = {}) => {
  const query = String(params.query ?? '').trim()

  // A pasted link cannot match a title, and TMDB will not say so any faster
  // than we can. Answering here saves the request and lets the picker explain
  // itself — see `looksLikeUrl` for why this is a whole category.
  if (looksLikeUrl(query)) {
    return {
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
      pastedUrl: true,
    }
  }

  const first = await searchOnce(params)
  if (renderableCount(first.results) > 0 || !query) return first

  for (const variant of looseningVariants(query).slice(
    0,
    MAX_LOOSENING_ATTEMPTS
  )) {
    const retry = await searchOnce({ ...params, query: variant })
    if (renderableCount(retry.results) > 0) {
      return { ...retry, matchedQuery: variant }
    }
  }

  return first
}
