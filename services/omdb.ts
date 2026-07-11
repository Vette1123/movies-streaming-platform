import { cache } from 'react'

// IMDb ratings aren't available from TMDB, so we read them from OMDb by imdb_id.
//
// OMDb's free tier is 1,000 requests/day. To live safely under that cap:
//   1. We NEVER call OMDb during the production build. `generateStaticParams`
//      prerenders ~1,000 detail pages; fetching there would blow the whole
//      daily budget in one deploy. Prebuilt pages simply ship with the TMDB
//      rating and pick up the IMDb score on their first on-demand revalidation.
//   2. Every call is cached for 30 days — IMDb scores barely move, so steady
//      state is a few dozen calls/day across the catalogue, not thousands.
//   3. Everything fails soft to `null`: a missing key, an exhausted daily cap,
//      a network blip, or a title with no IMDb score all transparently fall
//      back to the TMDB rating the UI already renders.
const OMDB_BASE_URL = 'https://www.omdbapi.com/'
const OMDB_REVALIDATE = 60 * 60 * 24 * 30 // 30 days
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

interface OmdbResponse {
  Response: 'True' | 'False'
  imdbRating?: string
  Error?: string
}

/**
 * The IMDb rating (e.g. "7.8") for a title by its imdb_id, or `null` when it
 * can't be resolved for any reason. Cached per-request via `cache()` and for
 * 30 days at the fetch layer. Safe to call on every detail render.
 */
const getImdbRating = cache(
  async (imdbId?: string | null): Promise<string | null> => {
    if (!imdbId) return null

    const apiKey = process.env.OMDB_API_KEY
    // No key or building: skip the network entirely and let the UI use TMDB.
    if (!apiKey || isBuildPhase) return null

    try {
      const url = `${OMDB_BASE_URL}?i=${encodeURIComponent(imdbId)}&apikey=${apiKey}`
      const res = await fetch(url, { next: { revalidate: OMDB_REVALIDATE } })
      if (!res.ok) return null

      const data = (await res.json()) as OmdbResponse
      if (data.Response !== 'True') return null

      const rating = data.imdbRating
      return rating && rating !== 'N/A' ? rating : null
    } catch {
      return null
    }
  }
)

export { getImdbRating }
