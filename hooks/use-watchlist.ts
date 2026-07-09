import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { trackWatchlistAdded, trackWatchlistRemoved } from '@/lib/analytics'
import { useLocalStorage, WatchedItem } from '@/hooks/use-local-storage'

type MediaItem = MovieDetails | SeriesDetails

// Deliberately a SEPARATE localStorage key from `watchedItems`. A watchlist is
// "want to watch" (a save/bookmark), whereas watch history is "already played".
// Keeping them apart means saving a title never pollutes the watched stats that
// syncWatchStats reports to PostHog (see hooks/use-watched-media.ts).
const WATCHLIST_KEY = 'watchlist'

interface WatchlistHookResult {
  watchlist: WatchedItem[]
  isSaved: (id: number) => boolean
  toggle: (media: MediaItem) => void
  remove: (id: number) => void
}

const toWatchedItem = (media: MediaItem): WatchedItem => {
  const isMovie = 'title' in media && !!(media as MovieDetails).title
  return {
    id: media.id,
    type: isMovie ? 'movie' : 'series',
    title: isMovie
      ? (media as MovieDetails).title
      : (media as SeriesDetails).name,
    overview: media.overview,
    backdrop_path: media.backdrop_path,
    poster_path: media.poster_path,
    added_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
  }
}

export function useWatchlist(): WatchlistHookResult {
  const [watchlist, setWatchlist] = useLocalStorage(WATCHLIST_KEY, [])

  const isSaved = (id: number) => watchlist.some((item) => item.id === id)

  const remove = (id: number) => {
    const existing = watchlist.find((item) => item.id === id)
    setWatchlist(watchlist.filter((item) => item.id !== id))
    if (existing) {
      trackWatchlistRemoved({
        media_id: id,
        media_type: existing.type === 'movie' ? 'movie' : 'tv',
        title: existing.title,
      })
    }
  }

  const toggle = (media: MediaItem) => {
    if (isSaved(media.id)) {
      remove(media.id)
      return
    }
    const item = toWatchedItem(media)
    setWatchlist([...watchlist, item])
    trackWatchlistAdded({
      media_id: item.id,
      media_type: item.type === 'movie' ? 'movie' : 'tv',
      title: item.title,
    })
  }

  return { watchlist, isSaved, toggle, remove }
}
