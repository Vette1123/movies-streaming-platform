/**
 * Turning somebody else's rows into TMDB ids.
 *
 * The only half of importing that cannot happen in the browser: the file is
 * parsed on the device (see parse.ts), and only the titles that need looking up
 * are sent here — no ratings, no dates, no file. One request resolves a batch,
 * and the client walks the file a batch at a time so the whole import is
 * bounded by the same 50-subrequest ceiling as everything else.
 *
 * An IMDb id resolves exactly through `/find`. A title and a year resolve
 * through `/search`, which is a guess — so the response says which of the two
 * happened, and the client shows the guesses before writing anything.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { fetchClient } from '@/lib/fetch-client'

/**
 * Rows resolved per request.
 *
 * One TMDB subrequest each, against a cap of 50 per invocation. Twenty leaves
 * ample headroom and still moves a 1,000-row Letterboxd export in fifty
 * requests, which takes well under a minute.
 */
const BATCH = 20
const MAX_BODY_BYTES = 64 * 1024
/** A title match this old or newer than the row's year is not the same film. */
const YEAR_SLACK = 1
/** Days: an id resolution is stable, so this is the longest TTL in the app. */
const TMDB_TTL = 7 * 24 * 60 * 60

interface Candidate {
  id?: number
  title?: string
  name?: string
  poster_path?: string | null
  release_date?: string
  first_air_date?: string
  media_type?: string
}

export interface ResolvedRow {
  /** Index in the batch the client sent, so it can put ratings back on. */
  index: number
  id: number
  type: 'movie' | 'series'
  title: string
  poster_path: string | null
  /** 'exact' came from an IMDb id; 'guess' came from a title search. */
  match: 'exact' | 'guess'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

const yearOf = (candidate: Candidate): number | null => {
  const date = candidate.release_date ?? candidate.first_air_date ?? ''
  const year = Number(date.slice(0, 4))
  return Number.isFinite(year) && year > 0 ? year : null
}

function shape(
  candidate: Candidate,
  index: number,
  match: 'exact' | 'guess'
): ResolvedRow | null {
  const id = Number(candidate.id)
  if (!Number.isInteger(id) || id <= 0) return null
  const isSeries =
    candidate.media_type === 'tv' || (!candidate.title && !!candidate.name)
  const title = candidate.title ?? candidate.name
  if (!title) return null
  return {
    index,
    id,
    type: isSeries ? 'series' : 'movie',
    title,
    poster_path: candidate.poster_path ?? null,
    match,
  }
}

/** The exact path: an IMDb id is a one-to-one mapping TMDB will confirm. */
async function byImdbId(
  imdb: string,
  index: number
): Promise<ResolvedRow | null> {
  const body = await fetchClient.get<{
    movie_results?: Candidate[]
    tv_results?: Candidate[]
  }>(`find/${imdb}?external_source=imdb_id`, {}, true, TMDB_TTL)

  const movie = body.movie_results?.[0]
  if (movie) return shape({ ...movie, media_type: 'movie' }, index, 'exact')
  const series = body.tv_results?.[0]
  if (series) return shape({ ...series, media_type: 'tv' }, index, 'exact')
  return null
}

/**
 * The guess: a title, and a year to break the ties with.
 *
 * `search/multi` rather than `search/movie`, because a Letterboxd export is
 * films and an IMDb one is not — the same file can hold both. The year filter is
 * applied here rather than passed to TMDB, whose `year` parameter is ignored by
 * the multi endpoint.
 */
async function byTitle(
  title: string,
  year: number | null,
  index: number
): Promise<ResolvedRow | null> {
  const body = await fetchClient.get<{ results?: Candidate[] }>(
    `search/multi?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`,
    {},
    true,
    TMDB_TTL
  )

  const results = (body.results ?? []).filter(
    (candidate) => candidate.media_type !== 'person'
  )
  if (results.length === 0) return null

  if (year !== null) {
    const dated = results.find((candidate) => {
      const found = yearOf(candidate)
      return found !== null && Math.abs(found - year) <= YEAR_SLACK
    })
    // Falling through to the first result when no year matches would import a
    // 2019 remake for a 1974 row. Better to leave it unresolved and say so.
    if (!dated) return null
    return shape(dated, index, 'guess')
  }

  return shape(results[0], index, 'guess')
}

interface RequestRow {
  imdb?: unknown
  title?: unknown
  year?: unknown
}

/** POST /api/import/resolve — up to BATCH rows in, resolved ids out. */
export async function handleImportResolve(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)
  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'Importing is a supporter feature.' },
      402
    )
  }

  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    return json({ success: false, error: 'Too much at once' }, 413)
  }

  let rows: RequestRow[]
  try {
    const body = (await request.json()) as { rows?: unknown }
    if (!Array.isArray(body.rows)) throw new Error('rows')
    rows = body.rows.slice(0, BATCH) as RequestRow[]
  } catch {
    return json({ success: false, error: 'Bad request' }, 400)
  }

  const resolved = await Promise.all(
    rows.map(async (row, index) => {
      const imdb = typeof row.imdb === 'string' ? row.imdb.trim() : ''
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      const year = Number.isInteger(row.year) ? (row.year as number) : null

      try {
        if (/^tt\d{7,}$/i.test(imdb)) return await byImdbId(imdb, index)
        if (title) return await byTitle(title, year, index)
      } catch {
        // A TMDB blip on one row. It comes back unresolved and the client says
        // so; failing the whole batch would throw away nineteen good matches.
      }
      return null
    })
  )

  return json({
    success: true,
    resolved: resolved.filter((row): row is ResolvedRow => row !== null),
    /** So the client can advance its cursor even when nothing matched. */
    requested: rows.length,
  })
}

export { BATCH as IMPORT_BATCH }
