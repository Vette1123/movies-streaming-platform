import { cache } from 'react'

import { ItemType } from '@/types/movie-result'
import { fetchClient } from '@/lib/fetch-client'

export interface WatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

interface WatchProvidersResponse {
  results: WatchProvider[]
}

// The list of streaming providers TMDB knows about for a media type in a given
// region, ordered by TMDB's own `display_priority` (Netflix/Prime/Disney+ first).
// Long-cached (revalidate:false, refreshed by the 4x/day redeploy) like the genre
// list — the provider roster is near-static. Fails soft to [] so the section just
// renders empty rather than throwing. The region matters: availability AND the
// roster differ per region, which is why the caller keys the query by region too.
export const getWatchProviders = cache(
  async (
    mediaType: ItemType,
    region: string = 'US'
  ): Promise<WatchProvider[]> => {
    try {
      const data = await fetchClient.get<WatchProvidersResponse>(
        `watch/providers/${mediaType}`,
        { watch_region: region, language: 'en-US' },
        true,
        false
      )
      const list = data?.results ?? []
      // Copy before sort — never mutate a cached array in place.
      return [...list].sort((a, b) => a.display_priority - b.display_priority)
    } catch {
      return []
    }
  }
)
