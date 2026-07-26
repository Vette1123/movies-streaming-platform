import { useCallback, useEffect } from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import {
  toAnalyticsMediaType,
  trackWatchHistoryAdded,
  trackWatchHistoryCleared,
  trackWatchHistoryItemRemoved,
  trackWatchHistoryUpdated,
} from '@/lib/analytics'
import { syncWatchStats } from '@/lib/person'
import { buildWatchedItem, useLocalStorage } from '@/hooks/use-local-storage'
import { readSeasonEpisodeParams } from '@/hooks/use-search-params'

type MediaItem = MovieDetails | SeriesDetails

// Explicit episode for the play that is about to start. Continue-watching
// resumes an episode that is NOT in the URL yet (a fresh visit has no
// ?season/?episode), so the caller passes it in rather than letting the empty
// query params fall back to S1E1 and overwrite real progress.
interface WatchTarget {
  season: number
  episode: number
}

interface WatchedMediaHookResult {
  handleWatchMedia: (media: MediaItem, target?: WatchTarget) => void
  watchedItems: ReturnType<typeof useLocalStorage>[0]
  deleteWatchedItems: () => void
  removeWatchedItem: (id: number) => void
}

export function useWatchedMedia(): WatchedMediaHookResult {
  const [watchedItems, setWatchedItems] = useLocalStorage('watchedItems', [])

  // Keep the PostHog person profile's behavioral stats in sync with the local
  // watch history (fires on mount and on every add / update / clear).
  useEffect(() => {
    syncWatchStats(watchedItems)
  }, [watchedItems])

  const deleteWatchedItems = useCallback(() => {
    trackWatchHistoryCleared({ item_count: watchedItems.length })
    setWatchedItems([])
  }, [watchedItems, setWatchedItems])

  const removeWatchedItem = useCallback(
    (id: number) => {
      const existing = watchedItems.find((item) => item.id === id)
      setWatchedItems(watchedItems.filter((item) => item.id !== id))
      if (existing) {
        trackWatchHistoryItemRemoved({
          media_id: id,
          media_type: toAnalyticsMediaType(existing.type),
          title: existing.title,
        })
      }
    },
    [watchedItems, setWatchedItems]
  )

  const handleWatchMedia = useCallback(
    (media: MediaItem, target?: WatchTarget) => {
      // Read at call time rather than via useSearchParams during render: the
      // hook bails the whole route to CSR under static prerender, which stripped
      // every detail page's markup from the HTML (see use-search-params.ts).
      const params = readSeasonEpisodeParams()
      const seasonQueryINT = target?.season || params.seasonQueryINT
      const episodeQueryINT = target?.episode || params.episodeQueryINT
      const isMovie = 'title' in media
      const existingItemIndex = watchedItems.findIndex(
        (item) => item.id === media.id
      )

      if (existingItemIndex === -1) {
        trackWatchHistoryAdded({
          media_id: media.id,
          media_type: isMovie ? 'movie' : 'tv',
          title: isMovie
            ? (media as MovieDetails).title
            : (media as SeriesDetails).name,
        })
        // Item not in localStorage, add it
        const newItem = buildWatchedItem(
          media,
          isMovie
            ? undefined
            : { season: seasonQueryINT || 1, episode: episodeQueryINT || 1 }
        )
        setWatchedItems([...watchedItems, newItem])
      } else {
        // Item already exists in localStorage
        const existingItem = watchedItems[existingItemIndex]

        if (!isMovie && existingItem.type === 'series') {
          // Only update series if season or episode changed
          if (
            existingItem.season !== seasonQueryINT ||
            existingItem.episode !== episodeQueryINT
          ) {
            const updatedItems = [...watchedItems]
            updatedItems[existingItemIndex] = {
              ...existingItem,
              season: seasonQueryINT || existingItem.season,
              episode: episodeQueryINT || existingItem.episode,
              modified_at: new Date().toISOString(),
            }
            trackWatchHistoryUpdated({
              media_id: media.id,
              media_type: 'tv',
              season: seasonQueryINT || existingItem.season,
              episode: episodeQueryINT || existingItem.episode,
            })
            setWatchedItems(updatedItems)
          }
        } else {
          // Just update the modified date for movies
          const updatedItems = [...watchedItems]
          updatedItems[existingItemIndex] = {
            ...existingItem,
            modified_at: new Date().toISOString(),
          }
          setWatchedItems(updatedItems)
        }
      }
    },
    [watchedItems, setWatchedItems]
  )

  return {
    handleWatchMedia,
    watchedItems,
    deleteWatchedItems,
    removeWatchedItem,
  }
}
