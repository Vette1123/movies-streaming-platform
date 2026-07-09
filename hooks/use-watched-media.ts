import { useEffect } from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import {
  trackWatchHistoryAdded,
  trackWatchHistoryCleared,
  trackWatchHistoryItemRemoved,
  trackWatchHistoryUpdated,
} from '@/lib/analytics'
import { syncWatchStats } from '@/lib/person'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useSearchQueryParams } from '@/hooks/use-search-params'

type MediaItem = MovieDetails | SeriesDetails

interface WatchedMediaHookResult {
  handleWatchMedia: (media: MediaItem) => void
  watchedItems: ReturnType<typeof useLocalStorage>[0]
  deleteWatchedItems: () => void
  removeWatchedItem: (id: number) => void
}

export function useWatchedMedia(): WatchedMediaHookResult {
  const [watchedItems, setWatchedItems] = useLocalStorage('watchedItems', [])
  const { seasonQueryINT, episodeQueryINT } = useSearchQueryParams()

  // Keep the PostHog person profile's behavioral stats in sync with the local
  // watch history (fires on mount and on every add / update / clear).
  useEffect(() => {
    syncWatchStats(watchedItems)
  }, [watchedItems])

  const deleteWatchedItems = () => {
    trackWatchHistoryCleared({ item_count: watchedItems.length })
    setWatchedItems([])
  }

  const removeWatchedItem = (id: number) => {
    const existing = watchedItems.find((item) => item.id === id)
    setWatchedItems(watchedItems.filter((item) => item.id !== id))
    if (existing) {
      trackWatchHistoryItemRemoved({
        media_id: id,
        media_type: existing.type === 'movie' ? 'movie' : 'tv',
        title: existing.title,
      })
    }
  }

  const handleWatchMedia = (media: MediaItem) => {
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
      if (isMovie) {
        // Handle movie
        setWatchedItems([
          ...watchedItems,
          {
            id: media.id,
            type: 'movie',
            title: media.title,
            overview: media.overview,
            backdrop_path: media.backdrop_path,
            poster_path: media.poster_path,
            added_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
          },
        ])
      } else {
        // Handle series
        setWatchedItems([
          ...watchedItems,
          {
            id: media.id,
            type: 'series',
            title: media.name,
            overview: media.overview,
            backdrop_path: media.backdrop_path,
            poster_path: media.poster_path,
            added_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            season: seasonQueryINT || 1,
            episode: episodeQueryINT || 1,
          },
        ])
      }
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
  }

  return {
    handleWatchMedia,
    watchedItems,
    deleteWatchedItems,
    removeWatchedItem,
  }
}
