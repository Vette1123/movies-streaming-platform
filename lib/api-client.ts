import { ReelItem } from '@/services/reels'
import { WatchProvider } from '@/services/watch-providers'

import { FilterParams } from '@/types/filter'
import { MediaResponse } from '@/types/media'
import { MovieGenre } from '@/types/movie-genre'
import { ItemType, Param } from '@/types/movie-result'
import { SeasonDetails } from '@/types/season-details'

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

// Reely Reels — one batch of the trailer feed per TMDB trending page.
export const getReelsApi = (page: number): Promise<ReelItem[]> =>
  getJson('/api/reels', { page })

// ---- Match Night + Watch Together (ephemeral D1 rooms on the Worker) -----

export async function postJson<T>(
  path: string,
  body: Record<string, unknown> = {}
) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, path)
  return (await res.json()) as T
}

export interface MatchHit {
  media_id: number
  media_type: 'movie' | 'tv'
  likers: number
}

export const createMatchRoomApi = (): Promise<{ code: string }> =>
  postJson('/api/match/room')

export const swipeApi = (input: {
  code: string
  swiper: string
  mediaId: number
  mediaType: 'movie' | 'tv'
  liked: boolean
}): Promise<{ ok: boolean }> => postJson('/api/match/swipe', input)

export interface MatchState {
  matches: MatchHit[]
  /** Distinct people who have swiped in this room, so the UI can say whether
   * anyone has joined yet rather than showing an empty panel either way. */
  swipers: number
}

export const matchHitsApi = (code: string): Promise<MatchState> =>
  getJson('/api/match/matches', { code })

export const createTogetherRoomApi = (): Promise<{ code: string }> =>
  postJson('/api/together/room')

export interface TogetherBeat {
  position: number
  playing: number
  updated_at: number
}

export const togetherBeatApi = (input: {
  code: string
  position: number
  playing: boolean
}): Promise<{ ok: boolean }> => postJson('/api/together/beat', input)

export const togetherStateApi = (code: string): Promise<TogetherBeat> =>
  getJson('/api/together/state', { code })
