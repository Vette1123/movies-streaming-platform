import { WatchProvider } from '@/services/watch-providers'

import { FilterParams } from '@/types/filter'
import { MediaResponse } from '@/types/media'
import { MovieGenre } from '@/types/movie-genre'
import { ItemType, Param } from '@/types/movie-result'
import { SeasonDetails } from '@/types/season-details'
import {
  type SelfHostTarget,
  type StreamResolveResult,
} from '@/lib/stream-resolver'

// The browser's half of what used to be Server Actions.
//
// A static export cannot contain Server Actions, so the same service functions
// now run inside cloudflare/worker.js and the client reaches them over HTTP.
// Every client caller goes through this module so the query-string contract
// lives in exactly one place — the Worker's router is the other half of it.

/**
 * A non-2xx answer from our own Worker API.
 *
 * Carries the status, so a caller can tell an expected 4xx — a made-up id, a
 * dead link, a crawler walking the TMDB id space — from a real failure. Without
 * it every bad id was retried twice (three Worker invocations for one wrong
 * URL) and filed as an $exception, which is what put "media fetch failed: 404"
 * in Error Tracking next to the real regressions.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    path: string
  ) {
    super(`${path} failed: ${status}`)
    this.name = 'ApiError'
  }
}

/**
 * The one fetch every client call goes through. Exported because the fallback
 * shells (app/*-fallback) hit endpoints that take no query string — they were
 * each hand-rolling these same four lines, and only this one throws an
 * `ApiError` the query layer can classify.
 */
export async function getJson<T>(
  path: string,
  params: Record<string, unknown> = {}
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  const res = await fetch(`${path}${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new ApiError(res.status, path)
  return (await res.json()) as T
}

export const searchMediaApi = (query: string): Promise<MediaResponse> =>
  getJson('/api/search', { query })

// Page 2+ of the /movies and /tv-shows browse lists. Page 1 is baked into the
// prerendered HTML; only scrolling past it reaches the Worker.
export const getPopularApi = (
  mediaType: ItemType,
  page: number
): Promise<MediaResponse> => getJson('/api/popular', { mediaType, page })

export const discoverApi = (
  mediaType: ItemType,
  filterParams: FilterParams = {},
  params: Param = {}
): Promise<MediaResponse> =>
  getJson('/api/filter', { ...filterParams, ...params, mediaType })

export const getGenreListApi = (mediaType: ItemType): Promise<MovieGenre[]> =>
  getJson('/api/genres', { mediaType })

export const getWatchProvidersApi = (
  mediaType: ItemType,
  region = 'US'
): Promise<WatchProvider[]> =>
  getJson('/api/watch-providers', { mediaType, region })

export const getSeasonEpisodesApi = (
  seasonId: number,
  seasonNumber: string
): Promise<SeasonDetails> =>
  getJson('/api/season-details', { seasonId, seasonNumber })

// The self-hosted player. Asks our Worker to walk the provider's resolve
// chain; the answer is a master m3u8 the browser then plays directly from the
// provider's CDN — no media bytes touch us (see lib/stream-resolver.ts).
export const resolveStreamApi = (
  target: SelfHostTarget
): Promise<StreamResolveResult> =>
  getJson('/api/stream/resolve', {
    type: target.type,
    id: target.id,
    season: target.season,
    episode: target.episode,
  })
