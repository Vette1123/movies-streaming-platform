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
  /** Download the watchlist as a JSON file. */
  exportWatchlist: () => void
  /** Parse an exported JSON file and merge it into the watchlist. */
  importWatchlist: (file: File) => Promise<void>
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

  const exportWatchlist = useCallback(() => {
    const data = JSON.stringify(watchlist, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reely-watchlist-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [watchlist])

  const importWatchlist = useCallback(
    async (file: File): Promise<void> => {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('That file is not valid JSON.')
      }
      if (!Array.isArray(parsed)) {
        throw new Error('The watchlist file must be a JSON array of titles.')
      }
      const incoming = parsed as Partial<WatchedItem>[]
      const existingIds = new Set(watchlist.map((item) => item.id))
      const added: WatchedItem[] = []
      for (const item of incoming) {
        if (!item.id || !item.title || existingIds.has(item.id)) continue
        const normalized: WatchedItem = {
          id: item.id,
          type: (item.type === 'series' ? 'series' : 'movie') as WatchedItem['type'],
          title: item.title,
          overview: item.overview ?? '',
          backdrop_path: item.backdrop_path ?? '',
          poster_path: item.poster_path ?? '',
          added_at: item.added_at ?? new Date().toISOString(),
          modified_at: new Date().toISOString(),
          ...(item.season !== undefined && { season: item.season }),
          ...(item.episode !== undefined && { episode: item.episode }),
        }
        existingIds.add(item.id)
        added.push(normalized)
      }
      if (!added.length) return
      setWatchlist([...watchlist, ...added])
    },
    [watchlist, setWatchlist]
  )

  return { watchlist, isSaved, toggle, remove, exportWatchlist, importWatchlist }
}
