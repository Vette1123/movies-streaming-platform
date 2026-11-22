'use client'

import type { WatchProvider } from '@/services/watch-providers'
import { useQuery } from '@tanstack/react-query'

import { ItemType } from '@/types/movie-result'
import { getWatchProvidersApi } from '@/lib/api-client'

const EMPTY: WatchProvider[] = []

/**
 * The streaming-provider roster for a media type + region, fetched from the
 * Worker's /api/watch-providers. Keyed by region because both the roster and its
 * ordering change per region. Fails soft to an empty list — the "Where to watch"
 * section just shows nothing rather than breaking the sidebar.
 *
 * `enabled`: only when somebody looks (the section is open) or a provider
 * filter needs its names. Every browse landing used to fetch it with the
 * section closed, and it was a challenged first request (7 of 31 api_errors,
 * 2026-11-20/21).
 */
export function useWatchProviders(
  mediaType: ItemType,
  region: string = 'US',
  enabled = true
): WatchProvider[] {
  const { data } = useQuery({
    queryKey: ['watch-providers', mediaType, region],
    queryFn: () => getWatchProvidersApi(mediaType, region),
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 1 day — the roster is near-static
  })

  return data ?? EMPTY
}
