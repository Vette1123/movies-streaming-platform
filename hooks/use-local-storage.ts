'use client'

import { useCallback, useSyncExternalStore } from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'

export interface WatchedItem {
  id: number
  type: 'movie' | 'series'
  title: string
  overview: string
  backdrop_path: string
  poster_path: string
  season?: number
  episode?: number
  /**
   * Your own score out of 10, and a line about why — set on the `reviews`
   * store and unused by every other one. Optional on the shared shape rather
   * than a separate type because a review IS a watched item with an opinion
   * attached: it carries the same id, title and artwork, syncs through the same
   * engine, and a second shape would mean a second copy of all of that.
   */
  rating?: number
  note?: string
  added_at: string
  modified_at: string
}

// Single builder for the WatchedItem persisted by watchlist / watch-history /
// completed. All three stored the same shape via near-identical inline objects;
// centralizing keeps the field set and the movie-vs-series discrimination in one
// place. `extra` carries series-only season/episode when the caller has it.
export function buildWatchedItem(
  media: MovieDetails | SeriesDetails,
  extra?: Pick<WatchedItem, 'season' | 'episode'>
): WatchedItem {
  const isMovie = 'title' in media && !!(media as MovieDetails).title
  const now = new Date().toISOString()
  return {
    id: media.id,
    type: isMovie ? 'movie' : 'series',
    title: isMovie
      ? (media as MovieDetails).title
      : (media as SeriesDetails).name,
    overview: media.overview,
    backdrop_path: media.backdrop_path,
    poster_path: media.poster_path,
    added_at: now,
    modified_at: now,
    ...extra,
  }
}

// ONE shared store per localStorage key, read through useSyncExternalStore.
//
// The old implementation gave every caller its own useState copy: each of the
// 100+ cards on the homepage parsed the whole `completedItems` array on mount
// AND wrote it straight back via a mount-time useEffect — N synchronous
// JSON.parse reads + N JSON.stringify writes on the main thread during
// hydration, the single biggest TBT/INP hit on the initial load. Hoisting to a
// module-level store means the array is parsed ONCE per key (lazily, on first
// subscribe), never written unless it actually changes, and every card reads
// the same reference. Mirrors hooks/use-recent-searches.ts.
type Setter = (
  next: WatchedItem[] | ((prev: WatchedItem[]) => WatchedItem[])
) => void

const EMPTY: WatchedItem[] = []

interface KeyStore {
  value: WatchedItem[]
  loaded: boolean
  listeners: Set<() => void>
}

const stores = new Map<string, KeyStore>()

function getStore(key: string): KeyStore {
  let store = stores.get(key)
  if (!store) {
    store = { value: EMPTY, loaded: false, listeners: new Set() }
    stores.set(key, store)
  }
  return store
}

// Parse the persisted array once, on first subscribe. Mutating value here (not
// notifying) is safe: useSyncExternalStore re-reads getSnapshot right after
// subscribe and re-renders if it changed from the EMPTY server snapshot.
function load(key: string) {
  const store = getStore(key)
  if (store.loaded) return
  store.loaded = true
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) store.value = JSON.parse(raw)
  } catch {
    // storage blocked or corrupt — keep EMPTY
  }
}

function commit(key: string, next: WatchedItem[]) {
  const store = getStore(key)
  store.value = next
  try {
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // ignore write failures (quota / private mode)
  }
  store.listeners.forEach((notify) => notify())
}

// Keep tabs in sync for free: another tab writing the same key updates this
// store and re-renders subscribers. Bound once, lazily, on first subscribe.
let storageBound = false
function bindStorage() {
  if (storageBound || typeof window === 'undefined') return
  storageBound = true
  window.addEventListener('storage', (event) => {
    if (!event.key) return
    const store = stores.get(event.key)
    if (!store) return
    try {
      store.value = event.newValue ? JSON.parse(event.newValue) : EMPTY
    } catch {
      return
    }
    store.listeners.forEach((notify) => notify())
  })
}

const getServerSnapshot = () => EMPTY

// The same three stores, reachable from outside React.
//
// Library sync (hooks/use-library-sync.ts) has to read and write every key
// without being a consumer of any of them: it runs once per page, not once per
// card, and it must not re-render anything by reading. These go through the same
// load/commit path as the hook, so a write from the sync engine notifies every
// subscribed card exactly as a user's own click does — which is what makes a
// pulled change appear immediately instead of on the next navigation.

export function readStore(key: string): WatchedItem[] {
  load(key)
  return getStore(key).value
}

export function writeStore(key: string, next: WatchedItem[]): void {
  load(key)
  commit(key, next)
}

/** Notify on any change to one key, including one made by another tab. */
export function subscribeStore(key: string, listener: () => void): () => void {
  bindStorage()
  load(key)
  const store = getStore(key)
  store.listeners.add(listener)
  return () => {
    store.listeners.delete(listener)
  }
}

export function useLocalStorage(
  key: string,
  _initialValue: WatchedItem[] = EMPTY
) {
  const subscribe = useCallback(
    (cb: () => void) => {
      bindStorage()
      load(key)
      const store = getStore(key)
      store.listeners.add(cb)
      return () => {
        store.listeners.delete(cb)
      }
    },
    [key]
  )

  const getSnapshot = useCallback(() => getStore(key).value, [key])

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setValue = useCallback<Setter>(
    (next) => {
      const current = getStore(key).value
      const resolved = typeof next === 'function' ? next(current) : next
      commit(key, resolved)
    },
    [key]
  )

  return [value, setValue] as const
}
