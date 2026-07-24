'use server'

import { getWatchProviders } from '@/services/watch-providers'

import { ItemType } from '@/types/movie-result'

// Thin server action so the client filter sidebar can read the long-cached,
// fail-soft watch-provider list without importing server-only code (mirrors
// getGenreListAction).
export async function getWatchProvidersAction(
  mediaType: ItemType,
  region: string = 'US'
) {
  return getWatchProviders(mediaType, region)
}
