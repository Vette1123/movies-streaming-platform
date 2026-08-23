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
  /**
   * Minutes for one sitting: the film's runtime, or one episode of the series.
   *
   * Captured here because this is the ONE moment it is free. The caller is on a
   * detail page and already holds the TMDB payload it comes from, so writing it
   * down costs nothing; asking for it later would be one TMDB request per title
   * in somebody's library, which is exactly the shape of request that blew the
   * 50-subrequest cap when IMDb ratings tried it.
   *
   * Optional because history recorded before this shipped does not have it.
   * lib/stats.ts falls back to an average for those and says so on screen, and
   * lib/stats/routes.ts backfills what the alert sweep happens to know.
   */
  runtime?: number
  added_at: string
  modified_at: string
}

// Single builder for the WatchedItem persisted by watchlist / watch-history /
// completed. All three stored the same shape via near-identical inline objects;
// centralizing keeps the field set and the movie-vs-series discrimination in one
// place. `extra` carries series-only season/episode when the caller has it.
/**
 * Minutes for one sitting, or undefined when TMDB has not said.
 *
 * A series reports an ARRAY, because an anthology's episodes vary; the first
 * entry is the typical one and is what every other consumer of this field in
 * the codebase uses (see lib/push/sweep.ts). Zero is treated as absent: TMDB
 * uses it for "unknown", and a zero stored as a real runtime would silently
 * drag an hours-watched total down instead of falling back to the average.
 */
function runtimeOf(media: WatchedSource, isMovie: boolean): number | undefined {
  const minutes = isMovie ? media.runtime : media.episode_run_time?.[0]
  return typeof minutes === 'number' && minutes > 0 ? minutes : undefined
}

/**
 * The least a thing can be and still become a WatchedItem.
 *
 * The two detail payloads satisfy it structurally, and so does a list card or
 * anything else carrying an id and a name. It exists because "not interested"
 * is triggered from a grid tile, which has never held a full TMDB detail
 * payload — and the alternative was a cast at the call site, which is the same
 * risk with the type checker switched off.
 */
export interface WatchedSource {
  id: number
  title?: string
  name?: string
  overview?: string | null
  backdrop_path?: string | null
  poster_path?: string | null
  runtime?: number | null
  episode_run_time?: number[] | null
}

const isBuiltItem = (
  media: WatchedSource
): media is WatchedSource & Pick<WatchedItem, 'type'> => {
  const candidate = media as Partial<WatchedItem>
  return (
    typeof candidate.added_at === 'string' &&
    (candidate.type === 'movie' || candidate.type === 'series')
  )
}

export function buildWatchedItem(
  media: WatchedSource,
  extra?: Pick<WatchedItem, 'season' | 'episode'>
): WatchedItem {
  // A raw TMDB payload says what it is by which of title/name it carries. An
  // item that has already been through here carries BOTH a type and a title (a
  // series' name is stored as `title`), so re-deriving from the title alone
  // turns every series into a movie - which is exactly what happened to every
  // series saved from a reel, because that rail pre-built its item and handed
  // it to `toggle`, which builds again. Building twice is now idempotent.
  //
  // The marker is `added_at`, not `type`: TMDB's own series payload has a
  // `type` field of its own ("Scripted", "Miniseries"), so that one proves
  // nothing.
  const isMovie = isBuiltItem(media) ? media.type === 'movie' : !!media.title
  const now = new Date().toISOString()
  return {
    runtime: runtimeOf(media, isMovie),
    id: media.id,
    type: isMovie ? 'movie' : 'series',
    title: (isMovie ? media.title : (media.name ?? media.title)) ?? '',
    overview: media.overview ?? '',
    backdrop_path: media.backdrop_path ?? '',
    poster_path: media.poster_path ?? '',
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
  listeners: Set<Listener>
}

/** Listeners learn WHICH key changed, so one subscriber can rate-limit per key. */
type Listener = (key: string) => void

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
  store.listeners.forEach((notify) => notify(key))
}

// Keep tabs in sync for free: another tab writing the same key updates this
// store and re-renders subscribers. Bound once, lazily, on first subscribe.
let storageBound = false
function bindStorage() {
  if (storageBound || typeof window === 'undefined') return
  storageBound = true
  window.addEventListener('storage', (event) => {
    if (!event.key) return
    const changedKey = event.key
    const store = stores.get(changedKey)
    if (!store) return
    try {
      store.value = event.newValue ? JSON.parse(event.newValue) : EMPTY
    } catch {
      return
    }
    store.listeners.forEach((notify) => notify(changedKey))
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
export function subscribeStore(
  key: string,
  listener: (changedKey: string) => void
): () => void {
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
