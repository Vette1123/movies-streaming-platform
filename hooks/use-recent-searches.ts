'use client'

import * as React from 'react'

const STORAGE_KEY = 'reely:recent-searches'
const MAX_RECENT = 6

// Module-level store so every palette instance shares one list and stays in
// sync, and so reads happen through useSyncExternalStore (no setState-in-effect,
// no hydration mismatch — the server snapshot is a stable empty array).
const EMPTY: string[] = []
let store: string[] = EMPTY
let loaded = false
const listeners = new Set<() => void>()

const load = () => {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) store = JSON.parse(raw)
  } catch {
    // ignore — storage blocked or corrupt
  }
}

const commit = (next: string[]) => {
  store = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  load()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => store
const getServerSnapshot = () => EMPTY

/**
 * The visitor's most recent search terms (newest first, de-duped
 * case-insensitively, capped at {@link MAX_RECENT}), persisted in localStorage.
 */
export function useRecentSearches() {
  const recent = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const add = React.useCallback((term: string) => {
    const value = term.trim()
    if (!value) return
    commit(
      [value, ...store.filter((t) => t.toLowerCase() !== value.toLowerCase())].slice(
        0,
        MAX_RECENT
      )
    )
  }, [])

  const remove = React.useCallback((term: string) => {
    commit(store.filter((t) => t !== term))
  }, [])

  const clear = React.useCallback(() => {
    commit([])
  }, [])

  return { recent, add, remove, clear }
}
