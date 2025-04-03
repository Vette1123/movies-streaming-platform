import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useSearchQueryParams } from '@/hooks/use-search-params'

interface WatchedMediaHookResult {
  handleWatchMedia: (media: MovieDetails & SeriesDetails) => void
  watchedItems: ReturnType<typeof useLocalStorage>[0]
  deleteWatchedItems: () => void
}

export function useWatchedMedia(): WatchedMediaHookResult {
  const [watchedItems, setWatchedItems] = useLocalStorage('watchedItems', [])
  const { seasonQueryINT, episodeQueryINT } = useSearchQueryParams()
  const deleteWatchedItems = () => setWatchedItems([])

  const handleWatchMedia = (media: MovieDetails & SeriesDetails) => {
    const isMovie = 'title' in media
    const existingItemIndex = watchedItems.findIndex(
      (item) => item.id === media.id
    )

    if (existingItemIndex === -1) {
      // Item not in localStorage, add it
      setWatchedItems([
        ...watchedItems,
        {
          id: media.id,
          type: isMovie ? 'movie' : 'series',
          title: media.title || media.name,
          overview: media.overview,
          backdrop_path: media.backdrop_path,
          poster_path: media.poster_path,
          added_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          ...(isMovie
            ? {}
            : {
                season: seasonQueryINT || 1,
                episode: episodeQueryINT || 1,
              }),
        },
      ])
    } else if (!isMovie) {
      // Item is a series and already in localStorage
      const existingItem = watchedItems[existingItemIndex]
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
      const updatedItems = [...watchedItems]
      updatedItems[existingItemIndex] = {
        ...watchedItems[existingItemIndex],
        modified_at: new Date().toISOString(),
      }
      setWatchedItems(updatedItems)
    }
  }

  return { handleWatchMedia, watchedItems, deleteWatchedItems }
}
