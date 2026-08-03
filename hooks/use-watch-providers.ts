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
 */
export function useWatchProviders(
  mediaType: ItemType,
  region: string = 'US'
): WatchProvider[] {
  const { data } = useQuery({
    queryKey: ['watch-providers', mediaType, region],
    queryFn: () => getWatchProvidersApi(mediaType, region),
    staleTime: 1000 * 60 * 60 * 24, // 1 day — the roster is near-static
  })

  return data ?? EMPTY
}
