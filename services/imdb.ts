import { cache } from 'react'

import { fetchClient } from '@/lib/fetch-client'

// The Workers static-assets binding, injected by cloudflare/worker.js on each
// request. It used to be pulled from `getCloudflareContext()`, but that is an
// OpenNext API and OpenNext no longer runs here — the site is a static export
// (see docs/superpowers/specs/2026-08-03-static-export-migration-design.md).
// Injection keeps this module runtime-agnostic: it stays null at build and
// under `next dev`, where the disk read and the self-fetch below cover it.
type AssetsBinding = { fetch: (input: URL) => Promise<Response> }
let assetsBinding: AssetsBinding | null = null

export const setImdbAssetsBinding = (binding: AssetsBinding | null): void => {
  assetsBinding = binding
}

// IMDb ratings come from IMDb's free Non-Commercial dataset (title.ratings),
// pre-sharded into small static JSON files by `scripts/build-imdb-ratings.mjs`.
// There is NO API and NO rate limit — we just read the shard that holds a given
// title. At build we read the shard straight off disk (so prebuilt pages ship
// with IMDb scores); at runtime we fetch the edge-cached static asset. Anything
// missing (shard absent, obscure title, ingest not run) fails soft to null so
// the UI falls back to the TMDB rating.
//
// Two flags, because the two uses cost different things.
//
// IMDB_RATING_SHARDS — the rating shards are shipped, and the details page
// reads them for the imdb_id the TMDB payload ALREADY carries, so it costs a
// local file read (build) and NO TMDB request at all. That is why this is
// safe to turn on.
//
// The flag is deliberately NOT `NEXT_PUBLIC_*`. Next and the Worker bundle
// inline every `NEXT_PUBLIC_*` at build time, so a public flag would switch
// the WORKER on too — and the Worker's detail path would then read a shard
// per request: one more subrequest and one more JSON parse on the route that
// is 63% of all invocations. A server-only env var stays a runtime lookup in
// the Worker, where it is undefined, so the Worker's CPU and subrequest
// profile is exactly what it is today.
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
const SHARD_REVALIDATE = 60 * 60 * 24 // 1 day — matches the dataset's cadence

// Loaded shards are memoised per isolate/build process so repeated lookups
// (and a page full of related titles) touch disk/network at most once per shard.
const shardCache = new Map<number, Record<string, string>>()

const shardFor = (tconst: string): number => {
  const n = parseInt(tconst.slice(2), 10)
  return Number.isFinite(n) ? n % NUM_SHARDS : 0
}

// Where the shards can be read from disk: the build and `next dev` both have
// a filesystem and a project root, and the Worker has neither.
//
// The dev case matters more than it looks: the runtime path reads the shard
// over HTTP, and the URL it uses is NEXT_PUBLIC_BASE_URL — production. So a
// local `pnpm dev` would only show IMDb ratings once the shards had been
// DEPLOYED, which is a confusing way to find out whether a feature works. The
// local shards are the same files, in the same place, so they are the ones to
// read.
//
// The Worker bundle inlines NODE_ENV as "production" (scripts/build-worker.mjs),
// so this is false there and the Worker never touches a filesystem — no extra
// CPU, no extra subrequest, no chance of a workerd "not implemented" throw.
const hasLocalShards =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NODE_ENV === 'development'

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
        'public',
        'imdb-ratings',
        `${shard}.json`
      )
      data = JSON.parse(await readFile(file, 'utf8'))
    } else {
      // Runtime. Read the shard from the Workers static-assets binding FIRST:
      // it serves the file straight from the deployed assets INSIDE the isolate
      // — no network, no WAF.
      //
      // A public self-fetch (`${base}/imdb-ratings/N.json`) is NOT usable in the
      // prod Worker. The `global_fetch_strictly_public` compat flag forces that
      // subrequest back out through the Cloudflare edge, where the WAF's
      // scraper-challenge rule (empty / non-browser User-Agent → managed
      // challenge) answers with a "Just a moment" 403 HTML page instead of JSON.
      // `res.ok` was then false, `data` stayed `{}`, and EVERY runtime IMDb
      // lookup failed soft to null — so the whole site showed TMDB ratings while
      // local/prebuilt (disk-read) pages looked fine. The assets binding never
      // touches the edge, so it can't be challenged.
      let res: Response | null = null
      try {
        if (assetsBinding) {
          res = await assetsBinding.fetch(
            new URL(`/imdb-ratings/${shard}.json`, 'https://assets.local')
          )
        }
      } catch {
        // No binding available (non-Worker runtime) — fall through to self-fetch.
      }

      // Fallback self-fetch. Used by `next dev` locally (where there's no WAF)
      // and as a prod safety net. Crucially it sends a browser User-Agent so it
      // CLEARS the WAF scraper challenge if it ever runs against the edge — the
      // missing UA is exactly what broke the old path.
      if (!res || !res.ok) {
        await res?.body?.cancel()
        const base = process.env.NEXT_PUBLIC_BASE_URL
        if (base) {
          res = await fetch(`${base}/imdb-ratings/${shard}.json`, {
            next: { revalidate: SHARD_REVALIDATE },
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            // Bound the self-fetch: a stalled edge asset request must not hang the
            // render. On abort we fail soft to no ratings (catch below).
            signal: AbortSignal.timeout(6000),
          })
        }
      }

      if (res && res.ok) data = (await res.json()) as Record<string, string>
      // A missing shard 404s; drain the unread body so it doesn't strand an
      // in-flight HTTP slot on the Worker isolate.
      else await res?.body?.cancel()
    }
  } catch {
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
