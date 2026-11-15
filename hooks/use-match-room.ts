'use client'

import * as React from 'react'

import { storageGet, storageRemove, storageSet } from '@/lib/safe-storage'

// Match Night's room code, shared across tabs and reloads through
// localStorage. useSyncExternalStore because the room is read during render:
// the server snapshot is null (no room prerendered), the client snapshot is
// the stored code, and writes go through setRoom so every tab stays in step.

const ROOM_KEY = 'match-night-room'

const listeners = new Set<() => void>()

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

export const useMatchRoom = () => {
  const room = React.useSyncExternalStore(
    subscribe,
    () => storageGet(ROOM_KEY),
    () => null
  )

  const setRoom = React.useCallback((code: string | null) => {
    if (code) storageSet(ROOM_KEY, code)
    else storageRemove(ROOM_KEY)
    listeners.forEach((cb) => cb())
  }, [])

  return [room, setRoom] as const
}
