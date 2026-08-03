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

async function getJson<T>(path: string, params: Record<string, unknown>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  const res = await fetch(`${path}${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
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
