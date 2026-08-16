import { useCallback } from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import {
  toAnalyticsMediaType,
  trackWatchlistAdded,
  trackWatchlistRemoved,
} from '@/lib/analytics'
import { maybeNudgeSupport } from '@/lib/support-nudge'
import {
  buildWatchedItem,
  useLocalStorage,
  WatchedItem,
} from '@/hooks/use-local-storage'

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

export function useWatchlist(): WatchlistHookResult {
  const [watchlist, setWatchlist] = useLocalStorage(WATCHLIST_KEY, [])

  const isSaved = useCallback(
    (id: number) => watchlist.some((item) => item.id === id),
    [watchlist]
  )

  const remove = useCallback(
    (id: number) => {
      const existing = watchlist.find((item) => item.id === id)
      setWatchlist(watchlist.filter((item) => item.id !== id))
      if (existing) {
        trackWatchlistRemoved({
          media_id: id,
          media_type: toAnalyticsMediaType(existing.type),
          title: existing.title,
        })
      }
    },
    [watchlist, setWatchlist]
  )

  const toggle = useCallback(
    (media: MediaItem) => {
      if (isSaved(media.id)) {
        remove(media.id)
        return
      }
      const item = buildWatchedItem(media)
      const next = [...watchlist, item]
      setWatchlist(next)
      // Here rather than in the buttons: every route to a save goes through this
      // one function, so the ask cannot fire twice from two call sites or be
      // forgotten by a third.
      maybeNudgeSupport(next.length)
      trackWatchlistAdded({
        media_id: item.id,
        media_type: toAnalyticsMediaType(item.type),
        title: item.title,
      })
    },
    [watchlist, setWatchlist, isSaved, remove]
  )

  return { watchlist, isSaved, toggle, remove }
}
