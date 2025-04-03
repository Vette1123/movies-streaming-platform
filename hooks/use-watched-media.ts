import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useSearchQueryParams } from '@/hooks/use-search-params'

type MediaItem = MovieDetails | SeriesDetails

interface WatchedMediaHookResult {
  handleWatchMedia: (media: MediaItem) => void
  watchedItems: ReturnType<typeof useLocalStorage>[0]
  deleteWatchedItems: () => void
}

export function useWatchedMedia(): WatchedMediaHookResult {
  const [watchedItems, setWatchedItems] = useLocalStorage('watchedItems', [])
  const { seasonQueryINT, episodeQueryINT } = useSearchQueryParams()
  const deleteWatchedItems = () => setWatchedItems([])

  const handleWatchMedia = (media: MediaItem) => {
    const isMovie = 'title' in media
    const existingItemIndex = watchedItems.findIndex(
      (item) => item.id === media.id
    )

    if (existingItemIndex === -1) {
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

  return { handleWatchMedia, watchedItems, deleteWatchedItems }
}
