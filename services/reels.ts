import { fetchClient } from '@/lib/fetch-client'

// Reely Reels — the trailer feed. One TMDB trending page per batch, mapped to
// the slim shape the feed renders. Runs in the Worker at /api/reels (runtime
// only); kept here so the TMDB contract stays in the shared services layer.

interface TrendingEntry {
  id: number
  media_type?: string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  overview?: string
  vote_average?: number
  backdrop_path?: string | null
  poster_path?: string | null
}

interface VideosResponse {
  results?: {
    key: string
    site: string
    type: string
    official?: boolean
    name?: string
  }[]
}

export interface ReelItem {
  id: number
  mediaType: 'movie' | 'tv'
  title: string
  year: string
  overview: string
  rating: number
  backdrop: string | null
  poster: string | null
  trailerKey: string
}

// TMDB's /trending silently IGNORES append_to_response=videos (measured
// 2026-08-23: the key never comes back), so each title needs its own /videos
// call. Ten titles keeps a batch at eleven subrequests — a fifth of the
// free-plan cap — and the 24h cache means a batch costs that once per day.
const TITLES_PER_BATCH = 10

const pickTrailer = (videos: VideosResponse): string | null => {
  const results = videos.results ?? []
  const trailers = results.filter(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  )
  const official = trailers.find((v) => v.official)
  return official?.key ?? trailers[0]?.key ?? null
}

const toReel = (entry: TrendingEntry, trailerKey: string): ReelItem => {
  const date = entry.release_date ?? entry.first_air_date ?? ''
  const mediaType: 'movie' | 'tv' =
    entry.media_type === 'tv' || (!entry.title && entry.name) ? 'tv' : 'movie'
  return {
    id: entry.id,
    mediaType,
    title: entry.title ?? entry.name ?? 'Untitled',
    year: date ? date.slice(0, 4) : '',
    overview: (entry.overview ?? '').trim(),
    rating: Math.round((entry.vote_average ?? 0) * 10) / 10,
    backdrop: entry.backdrop_path ?? null,
    poster: entry.poster_path ?? null,
    trailerKey,
  }
}

const reelFor = async (entry: TrendingEntry): Promise<ReelItem | null> => {
  const mediaType: 'movie' | 'tv' =
    entry.media_type === 'tv' || (!entry.title && entry.name) ? 'tv' : 'movie'
  try {
    const videos = await fetchClient.get<VideosResponse>(
      `${mediaType}/${entry.id}/videos`,
      {},
      true,
      86400
    )
    const trailerKey = pickTrailer(videos)
    if (!trailerKey) return null
    return toReel(entry, trailerKey)
  } catch {
    // A dead id or a TMDB hiccup drops one slide, never the batch.
    return null
  }
}

/**
 * One batch of reels from TMDB trending. `page` maps 1:1 to TMDB's own page
 * number, so the feed's infinite scroll is a plain cursor. Only ~half of
 * trending carries an official trailer — when a page filters down to almost
 * nothing we top up from the next page.
 */
export const getReels = async (page: number): Promise<ReelItem[]> => {
  const collect = async (tmdbPage: number): Promise<ReelItem[]> => {
    const data = await fetchClient.get<{ results?: TrendingEntry[] }>(
      'trending/all/week',
      { page: tmdbPage },
      true,
      86400
    )
    const entries = (data.results ?? []).slice(0, TITLES_PER_BATCH)
    const reels = await Promise.all(entries.map(reelFor))
    return reels.filter((reel): reel is ReelItem => reel !== null)
  }

  const first = await collect(page)
  if (first.length >= 5) return first
  const second = await collect(page + 1)
  const seen = new Set(first.map((r) => r.id))
  return [...first, ...second.filter((r) => !seen.has(r.id))]
}
