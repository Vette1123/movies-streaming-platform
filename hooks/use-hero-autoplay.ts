'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Persisted user preference: should the hero autoplay muted trailer previews on
// touch devices? Default ON (empty/unknown === on); the user can opt out and it
// sticks across slides, reloads, and tabs.
const KEY = 'reely:hero-autoplay'

const listeners = new Set<() => void>()

function isOn(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(KEY) !== 'off'
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  // Cross-tab: another tab flipping the pref writes localStorage → sync here.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function setHeroAutoplay(on: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, on ? 'on' : 'off')
  // Notify same-tab subscribers (the storage event only fires in *other* tabs).
  listeners.forEach((l) => l())
}

/**
 * Read + toggle the hero trailer-autoplay preference. useSyncExternalStore keeps
 * the SSR/first-client render (always ON) consistent, then reconciles to the
 * stored value after hydration without a mismatch.
 */
export function useHeroAutoplay(): { enabled: boolean; toggle: () => void } {
  const enabled = useSyncExternalStore(subscribe, isOn, () => true)
  const toggle = useCallback(() => setHeroAutoplay(!isOn()), [])
  return { enabled, toggle }
}
