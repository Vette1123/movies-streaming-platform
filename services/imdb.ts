import { cache } from 'react'

import { fetchClient } from '@/lib/fetch-client'

// IMDb ratings come from IMDb's free Non-Commercial dataset (title.ratings),
// pre-sharded into small static JSON files by `scripts/build-imdb-ratings.mjs`.
// There is NO API and NO rate limit — we just read the shard that holds a given
// title. At build we read the shard straight off disk (so prebuilt pages ship
// with IMDb scores); at runtime we fetch the edge-cached static asset. Anything
// missing (shard absent, obscure title, ingest not run) fails soft to null so
// the UI falls back to the TMDB rating.
//
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

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

const loadShard = async (shard: number): Promise<Record<string, string>> => {
  const cached = shardCache.get(shard)
  if (cached) return cached

  let data: Record<string, string> = {}
  try {
    if (isBuildPhase) {
      // Build (Node): read the generated shard directly from public/.
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
      // Runtime (edge): fetch the static asset, edge- and fetch-cached.
      const base = process.env.NEXT_PUBLIC_BASE_URL
      if (base) {
        const res = await fetch(`${base}/imdb-ratings/${shard}.json`, {
          next: { revalidate: SHARD_REVALIDATE },
          // Bound the self-fetch: a stalled edge asset request must not hang the
          // render. On abort we fail soft to no ratings (catch below).
          signal: AbortSignal.timeout(6000),
        })
        if (res.ok) data = (await res.json()) as Record<string, string>
      }
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
    if (!imdbId) return null
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
    if (!id) return null
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
): Promise<(T & { imdbRating: string | null })[]> =>
  Promise.all(
    items.map(async (item) => ({
      ...item,
      imdbRating: await getImdbRatingByTmdbId(item.id, mediaType),
    }))
  )

export { getImdbRating, getImdbRatingByTmdbId, attachImdbRatings }
