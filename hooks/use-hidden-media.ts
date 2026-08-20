import { useCallback, useMemo } from 'react'

import { trackNotInterested, trackNotInterestedUndone } from '@/lib/analytics'
import {
  buildWatchedItem,
  useLocalStorage,
  WatchedItem,
  WatchedSource,
} from '@/hooks/use-local-storage'

/**
 * "Not interested" — titles to keep out of recommendations and rails.
 *
 * Its own localStorage key, and its own sync store, for the same reason the
 * watchlist is separate from the watch history: hiding something is a statement
 * about what you want to be shown, not about what you have seen, and folding it
 * into either one would corrupt the stats built on them.
 *
 * The server side is nearly free. `hidden` is in SYNC_STORES, so it rides the
 * ordinary per-title sync and follows a supporter between devices with no new
 * endpoint — and lib/foryou/routes.ts excludes it without a line of change,
 * because its exclusion set is built from EVERY key in EVERY store.
 *
 * The full item is stored rather than a bare id, so the account page can show
 * what you hid, with its artwork, and let you undo it. A list of numbers would
 * be a list nobody could read.
 */
const HIDDEN_KEY = 'hiddenItems'

interface HiddenMediaHookResult {
  hidden: WatchedItem[]
  /** Ids only, for the O(1) test every card on a page makes. */
  hiddenIds: Set<number>
  isHidden: (id: number) => boolean
  hide: (media: WatchedSource) => void
  unhide: (id: number) => void
  clear: () => void
}

export function useHiddenMedia(): HiddenMediaHookResult {
  const [hidden, setHidden] = useLocalStorage(HIDDEN_KEY, [])

  // A Set, memoised on the array reference, because the caller is a grid: a
  // hundred cards each running `.some()` over a few hundred hidden titles is
  // the kind of quadratic scan that only shows up on the devices least able to
  // absorb it.
  const hiddenIds = useMemo(
    () => new Set(hidden.map((item) => item.id)),
    [hidden]
  )

  const isHidden = useCallback((id: number) => hiddenIds.has(id), [hiddenIds])

  const hide = useCallback(
    (media: WatchedSource) => {
      if (hiddenIds.has(media.id)) return
      // One builder for every store, so a hidden title carries the same shape
      // (and the same key) as a watchlisted one. See WatchedSource: it is the
      // structural minimum precisely so a grid tile can be hidden without a
      // cast or a second nearly-identical builder.
      const item = buildWatchedItem(media)
      setHidden([...hidden, item])
      trackNotInterested({
        media_id: item.id,
        media_type: item.type === 'movie' ? 'movie' : 'tv',
        title: item.title,
      })
    },
    [hidden, hiddenIds, setHidden]
  )

  const unhide = useCallback(
    (id: number) => {
      const existing = hidden.find((item) => item.id === id)
      setHidden(hidden.filter((item) => item.id !== id))
      if (existing) {
        trackNotInterestedUndone({
          media_id: id,
          media_type: existing.type === 'movie' ? 'movie' : 'tv',
          title: existing.title,
        })
      }
    },
    [hidden, setHidden]
  )

  const clear = useCallback(() => setHidden([]), [setHidden])

  return { hidden, hiddenIds, isHidden, hide, unhide, clear }
}
