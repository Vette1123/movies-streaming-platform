'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Persisted user preference: should the hero autoplay muted trailer previews?
// Tri-state on purpose — 'on' / 'off' / unset. Unset falls back to `defaultOn`,
// which the caller derives from the device tier (weak phones default off, see
// use-device-tier). An EXPLICIT choice always beats the heuristic: the device
// tier may pick the default, it may not override the user. Previously the tier
// gated playback directly, so on a phone the toggle read ON while the trailer
// could never start.
const KEY = 'reely:hero-autoplay'

const listeners = new Set<() => void>()

function isOn(defaultOn: boolean): boolean {
  if (typeof window === 'undefined') return defaultOn
  const stored = window.localStorage.getItem(KEY)
  if (stored === 'on') return true
  if (stored === 'off') return false
  return defaultOn
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
 * the SSR/first-client render (`defaultOn`) consistent, then reconciles to the
 * stored value after hydration without a mismatch.
 *
 * `defaultOn` only decides what "never chosen" means; once the user touches the
 * toggle their choice is what's read back, on every device.
 */
export function useHeroAutoplay(defaultOn: boolean): {
  enabled: boolean
  toggle: () => void
} {
  const read = useCallback(() => isOn(defaultOn), [defaultOn])
  // getServerSnapshot must return what the SERVER rendered, and it is called on
  // the client too — during hydration. Passing `read` here looked harmless but
  // reintroduced a hydration mismatch: on the server `isOn` short-circuits on
  // `typeof window === 'undefined'` and yields `defaultOn`, while the same
  // function on the client reads localStorage and could answer 'on' against
  // HTML that was exported as off. So this deliberately ignores storage.
  const enabled = useSyncExternalStore(subscribe, read, () => defaultOn)
  const toggle = useCallback(() => setHeroAutoplay(!read()), [read])
  return { enabled, toggle }
}
