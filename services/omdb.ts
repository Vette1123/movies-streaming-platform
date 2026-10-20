// The OMDb API — free tier: 1,000 requests a day, no card, no cost.
//
// It is the only cost-free source that carries Rotten Tomatoes and Metacritic
// scores beside IMDb's, and it answers by IMDb id — the id the TMDB detail
// payload already carries. A rating lookup therefore costs NO extra TMDB
// request and no subrequest against the Cloudflare free-plan cap, which is the
// whole reason the details page can show four ratings and the list pages
// cannot.
//
// Everything here fails soft to null: no key configured, a title OMDb does not
// know, the daily cap reached, a network error. A details page that cannot
// reach OMDb shows the ratings it does have.
//
// The quota is the design constraint, so the cache is not an optimisation here:
// every answer is written to disk and read back (lib/omdb-cache.ts), the
// day's spend is bounded by a file, and a build that finds the cap reached
// stops asking — it does not spend the rest of the day being refused.
//
// Not the TMDB client: this is a different host with a different quota, and the
// governor in lib/fetch-client exists to protect TMDB's.

import {
  FRESH_MS,
  MISSING_MS,
  omdbBudgetLeft,
  readCachedOmdb,
  takeOmdbBudget,
  writeCachedOmdb,
} from '@/lib/omdb-cache'

const OMDB_URL = 'https://www.omdbapi.com/'

export interface OmdbRatings {
  /** IMDb's own score, out of 10 — "8.6". */
  imdbRating?: number
  /** How many people voted on IMDb. */
  imdbVotes?: number
  /** Rotten Tomatoes critic score (the Tomatometer), out of 100. */
  rottenTomatoes?: number
  /** Metacritic score, out of 100. */
  metacritic?: number
}

interface OmdbRatingRow {
  Source?: string
  Value?: string
}

interface OmdbResponse {
  Response?: string
  Error?: string
  imdbRating?: string
  imdbVotes?: string
  Metascore?: string
  Ratings?: OmdbRatingRow[]
}

/**
 * "91%" → 91, "82/100" → 82, "9.3/10" → 9.3, "N/A" → null.
 *
 * OMDb writes every score in its own scale, and the scale is in the string —
 * there is no field that says which one a value uses.
 */
export const parseOmdbScore = (value?: string | null): number | null => {
  if (!value) return null
  const text = value.trim()
  if (!text || text === 'N/A') return null
  const number = Number.parseFloat(text)
  if (!Number.isFinite(number)) return null
  // "9.3/10" is a score out of ten; "91%" and "82/100" are out of a hundred.
  // OMDb only ever writes one of those three shapes, so the scale is read off
  // the string rather than guessed.
  if (text.includes('/10')) return number
  return number
}

/**
 * "2,948,373" → 2948373, "1,234" → 1234, "N/A" → null.
 */
export const parseOmdbVotes = (value?: string | null): number | null => {
  if (!value) return null
  const text = value.replace(/[^\d]/g, '')
  if (!text) return null
  const number = Number.parseInt(text, 10)
  return Number.isFinite(number) ? number : null
}

/**
 * The ratings in an OMDb response, or null when it carries none.
 *
 * Pure: the shape of the response is the only input, so this is what the
 * tests pin. A title OMDb does not know answers `Response: "False"`, which
 * is not an error — it is a title without a score.
 */
export const parseOmdbRatings = (
  body: OmdbResponse | null | undefined
): OmdbRatings | null => {
  if (!body || body.Response === 'False') return null

  const rows = body.Ratings ?? []
  const rottenRow = rows.find(
    (row) => row.Source?.toLowerCase() === 'rotten tomatoes'
  )
  const metascoreRow = rows.find(
    (row) => row.Source?.toLowerCase() === 'metacritic'
  )

  const ratings: OmdbRatings = {
    imdbRating: parseOmdbScore(body.imdbRating) ?? undefined,
    imdbVotes: parseOmdbVotes(body.imdbVotes) ?? undefined,
    rottenTomatoes: parseOmdbScore(rottenRow?.Value) ?? undefined,
    // The top-level Metascore is the movie's aggregate; the Ratings row is
    // the same number again, and only one of the two is ever present.
    metacritic:
      parseOmdbScore(metascoreRow?.Value) ??
      parseOmdbScore(body.Metascore) ??
      undefined,
  }

  const hasAny =
    ratings.imdbRating !== undefined ||
    ratings.imdbVotes !== undefined ||
    ratings.rottenTomatoes !== undefined ||
    ratings.metacritic !== undefined
  return hasAny ? ratings : null
}

/**
 * Set once OMDb refuses us for the day, so the rest of the build stops
 * asking instead of spending the remainder of the quota being told no.
 */
let quotaSpent = false

/** True when the day's quota is gone and no more requests should be made. */
export const isOmdbQuotaSpent = (): boolean => quotaSpent

/** The first request of a build says so once, with what is left of the day. */
let announced = false

/**
 * The ratings for one title, or null.
 *
 * The key is read from the environment: `OMDB_API_KEY` locally, and a GitHub
 * secret in production. Without a key this returns null immediately — no
 * request, no key error in the logs, no rate-limit counter burnt.
 *
 * The answer is cached on disk (lib/omdb-cache.ts): the free tier allows
 * 1,000 requests a day and the details build renders about a thousand pages,
 * so a build that fetched every rating every time would spend the whole quota
 * on the first run and fail every day after it.
 */
export const getOmdbRatings = async (
  imdbId?: string | null
): Promise<OmdbRatings | null> => {
  const key = process.env.OMDB_API_KEY
  if (!key || !imdbId || !/^tt\d{7,8}$/.test(imdbId)) return null

  // 1. The cache. A rating that has been seen is not fetched again for a
  //    month; a title OMDb does not know is re-checked weekly, so a title it
  //    adds later still gets a score.
  const cached = await readCachedOmdb<OmdbRatings>(imdbId)
  if (cached) {
    const age = Date.now() - cached.at
    const life = cached.value ? FRESH_MS : MISSING_MS
    if (age < life) return cached.value
  }

  // 2. The day's budget. Refused means no request, and the title waits for
  //    the next day rather than being asked and refused.
  if (quotaSpent) return null
  if (!(await takeOmdbBudget())) {
    quotaSpent = true
    console.warn(
      `[omdb] today's request budget is spent (${imdbId} and the rest of this build are answered from the cache)`
    )
    return null
  }
  if (!announced) {
    announced = true
    console.log(
      `[omdb] fetching ratings, ${await omdbBudgetLeft()} request(s) left in today's budget`
    )
  }

  try {
    // No `type`: OMDb would then answer for a MOVIE only, and a series would
    // come back "Movie not found". Without it, OMDb answers for whatever the
    // IMDb id is.
    const url = `${OMDB_URL}?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbId)}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    })
    const body = (await res.json().catch(() => null)) as OmdbResponse | null

    // A refused key or an exhausted quota: stop for the day. Asking again
    // for the other thousand titles would spend nothing and gain nothing.
    if (res.status === 401) {
      quotaSpent = true
      console.warn(
        `[omdb] ${body?.Error ?? 'request refused'} — no more OMDb requests this build`
      )
      return null
    }
    if (!res.ok) return null

    const ratings = parseOmdbRatings(body)
    // A title OMDb does not know is cached as a MISSING answer, with a short
    // life, so it does not cost a request on every build forever.
    await writeCachedOmdb(imdbId, ratings)
    return ratings
  } catch {
    return null
  }
}

/** How much of today's OMDb budget is left. For the build log. */
export const omdbRequestsLeft = omdbBudgetLeft
