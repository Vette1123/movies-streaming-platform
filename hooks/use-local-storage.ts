'use client'

import { useCallback, useSyncExternalStore } from 'react'

export interface WatchedItem {
  id: number
  type: 'movie' | 'series'
  title: string
  overview: string
  backdrop_path: string
  poster_path: string
  season?: number
  episode?: number
  added_at: string
  modified_at: string
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
type Setter = (next: WatchedItem[] | ((prev: WatchedItem[]) => WatchedItem[])) => void

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
