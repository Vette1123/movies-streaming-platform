import { cache } from 'react'

import { fetchClient } from '@/lib/fetch-client'

// IMDb ratings come from IMDb's free Non-Commercial dataset (title.ratings),
// pre-sharded into small static JSON files by `scripts/build-imdb-ratings.mjs`.
// There is NO API and NO rate limit — we just read the shard that holds a given
// title.
//
// The shards are a BUILD INPUT and nothing else: they live in `.cache/`, they
// are read off disk while the pages are rendered, and the score they carry is
// baked into the prerendered HTML. Nothing fetches them at runtime, so they
// are not in the static export and not in the Worker's assets — 256 files
// that would otherwise be dead weight against the 20,000-file asset cap.
//
// Two flags, because the two uses cost different things.
//
// IMDB_RATING_SHARDS — the rating shards are built, and the details page reads
// them for the imdb_id the TMDB payload ALREADY carries, so it costs a local
// file read and NO TMDB request at all. That is why this is safe to turn on.
//
// The flag is deliberately NOT `NEXT_PUBLIC_*`. Next and the Worker bundle
// inline every `NEXT_PUBLIC_*` at build time, so a public flag would switch
// the WORKER on too — and the Worker's detail path would then look for a shard
// per request, on the route that is 63% of all invocations. A server-only env
// var stays a runtime lookup in the Worker, where it is undefined, so the
// Worker's CPU and subrequest profile is exactly what it is today.
//
// IMDB_RATING_LISTS — per-item enrichment of LIST rows. A TMDB list endpoint
// does not carry imdb_id, so every row needs an `external_ids` lookup first: a
// full homepage render fanned out ~120+ subrequests and blew the Cloudflare
// free-plan 50-subrequests/invocation cap ("Too many subrequests by single
// Worker invocation"), which cascaded into the hero fetch failing and the
// whole page 500ing. OFF unless somebody asks for it, and then only on a plan
// with room for it.
const IMDB_SHARDS = process.env.IMDB_RATING_SHARDS === 'true'
const IMDB_LISTS = process.env.IMDB_RATING_LISTS === 'true'

// NUM_SHARDS MUST stay in sync with scripts/build-imdb-ratings.mjs.
const NUM_SHARDS = 256

// Loaded shards are memoised per build process so repeated lookups (and a page
// full of related titles) touch disk at most once per shard.
const shardCache = new Map<number, Record<string, string>>()

const shardFor = (tconst: string): number => {
  const n = parseInt(tconst.slice(2), 10)
  return Number.isFinite(n) ? n % NUM_SHARDS : 0
}

// Where the shards can be read from disk: the build and `next dev` both have
// a filesystem and a project root, and the Worker has neither.
//
// The Worker bundle inlines NODE_ENV as "production" (scripts/build-worker.mjs),
// so this is false there and the Worker never touches a filesystem — no extra
// CPU, no extra subrequest, no chance of a workerd "not implemented" throw.
// (The Worker does not need a rating: the pages that show one are prerendered,
// and the tail-id fallback serves the exported shell, which has no ratings in
// it.)
const hasLocalShards =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NODE_ENV !== 'production'

const loadShard = async (shard: number): Promise<Record<string, string>> => {
  const cached = shardCache.get(shard)
  if (cached) return cached

  let data: Record<string, string> = {}
  try {
    if (hasLocalShards) {
      // Build or dev (Node): read the generated shard straight off disk.
      const [{ readFile }, path] = await Promise.all([
        import('node:fs/promises'),
        import('node:path'),
      ])
      const file = path.join(
        process.cwd(),
        '.cache',
        'imdb-ratings',
        `${shard}.json`
      )
      data = JSON.parse(await readFile(file, 'utf8'))
    }
  } catch {
    // A missing shard (the ingest did not run) fails soft to no ratings, and
    // the page falls back to the TMDB average.
    data = {}
  }

  shardCache.set(shard, data)
  return data
}

/**
 * IMDb rating (e.g. "8.6") for a title by its imdb_id / tconst, or null if it
 * can't be resolved. Backed by IMDb's free dataset — no key, no rate limit.
 */
const getImdbRating = cache(
  async (imdbId?: string | null): Promise<string | null> => {
    if (!IMDB_SHARDS || !imdbId) return null
    const shard = await loadShard(shardFor(imdbId))
    return shard[imdbId] ?? null
  }
)

// TMDB list endpoints (trending/popular/top-rated/search) omit imdb_id, so to
// score a list item we first resolve its IMDb id via the lightweight external_ids
// endpoint. That TMDB↔IMDb mapping is immutable, so cache it for 30 days: repeat
// renders re-read the shard (free) without re-writing the fetch cache, keeping us
// well under the free-plan KV write budget even across many rows.
const IMDB_ID_REVALIDATE = 60 * 60 * 24 * 30 // 30 days

const getImdbRatingByTmdbId = cache(
  async (id: number, mediaType: 'movie' | 'tv'): Promise<string | null> => {
    if (!IMDB_LISTS || !id) return null
    try {
      const { imdb_id } = await fetchClient.get<{ imdb_id?: string | null }>(
        `${mediaType}/${id}/external_ids`,
        {},
        true,
        IMDB_ID_REVALIDATE
      )
      return await getImdbRating(imdb_id)
    } catch {
      return null
    }
  }
)

/**
 * Attach a real IMDb rating to each TMDB list item. Lookups run through the
 * fetch-client's concurrency governor (so a full page of rows can't stampede
 * TMDB) and fail soft to null per item — the card then falls back to the TMDB
 * average. Returns a new array; inputs are not mutated.
 */
const attachImdbRatings = async <T extends { id: number }>(
  items: T[],
  mediaType: 'movie' | 'tv'
): Promise<(T & { imdbRating: string | null })[]> => {
  // Flag off: skip the per-item external_ids fan-out entirely (this is the fetch
  // storm that tripped the subrequest cap). Cards fall back to the TMDB rating.
  if (!IMDB_LISTS) {
    return items.map((item) => ({ ...item, imdbRating: null }))
  }
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      imdbRating: await getImdbRatingByTmdbId(item.id, mediaType),
    }))
  )
}

export { getImdbRating, getImdbRatingByTmdbId, attachImdbRatings }
