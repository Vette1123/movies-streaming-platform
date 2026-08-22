'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  clearSyncState,
  subscribeLibrary,
  syncOnce,
  type SyncStatus,
} from '@/lib/library-sync'
import { PLAYBACK_STORAGE_KEY } from '@/lib/playback-positions'
import { useAccount } from '@/hooks/use-account'
import { subscribeStore, writeStore } from '@/hooks/use-local-storage'

/**
 * How long after the last change a sync fires.
 *
 * Ticking a season of episodes is a dozen writes in a few seconds; syncing each
 * one would be a dozen requests against a 100k/day budget for a single result.
 * Two seconds collapses a burst into one round trip and is short enough that
 * picking up another device immediately still finds the change.
 */
const DEBOUNCE_MS = 2000

/**
 * How long a playback position waits before it is pushed.
 *
 * The player writes its position every ~5 seconds while something plays. Those
 * intermediate ticks are worthless on their own — only the newest position
 * matters — so they ride a longer fuse than library edits and still land the
 * moment attention leaves the page (the visibilitychange flush below). One
 * push per ~30s of continuous watching keeps a binge from turning into a
 * request every five seconds against the invocation budget.
 */
const RESUME_DEBOUNCE_MS = 30_000

/**
 * How often an open tab pulls while somebody is actually looking at it.
 *
 * This is the other half of "real time": the debounces above ship THIS device's
 * changes, but a change made on your phone reaches your laptop only when the
 * laptop asks. While the document is visible it asks this often; hidden tabs
 * ask never. Bounded by attention, not by wall-clock — nobody pays for a tab
 * left open overnight, and returning to a tab is answered instantly by the
 * visibilitychange handler below rather than by waiting out the interval.
 */
const PULL_INTERVAL_MS = 20_000

/**
 * Drive library sync for the whole app.
 *
 * Mounted exactly once, in the layout. It does nothing at all — no request, no
 * listener, no timer — unless the visitor is signed in AND supporting, so the
 * common case costs a boolean check.
 */
export function useLibrarySync(): {
  status: SyncStatus
  syncNow: () => Promise<void>
} {
  const { signedIn, pro } = useAccount()
  const [status, setStatus] = useState<SyncStatus>('idle')
  const running = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = useCallback(async () => {
    // One at a time. A second sync started mid-flight would diff against a
    // mirror the first one is about to replace, and send the same rows twice.
    if (running.current) return
    running.current = true
    setStatus('syncing')
    try {
      let result = await syncOnce(writeStore)
      // A truncated pull means the server had more than one page of changes —
      // a first sign-in on a device with a long history. Keep going rather than
      // leaving the library half-restored until the next edit.
      let guard = 0
      while (result.ok && result.more && guard++ < 20) {
        result = await syncOnce(writeStore)
      }
      setStatus(result.ok ? 'idle' : 'error')
    } finally {
      running.current = false
    }
  }, [])

  useEffect(() => {
    if (!signedIn || !pro) return

    const schedule = (delay: number) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void run(), delay)
    }
    // Library edits ship fast; position ticks wait out the long fuse. The key
    // comes from the store layer, which knows which localStorage key moved.
    const onChanged = (key: string) =>
      schedule(key === PLAYBACK_STORAGE_KEY ? RESUME_DEBOUNCE_MS : DEBOUNCE_MS)

    // Once on mount: this restores the library on a new device, picks up what
    // other devices pushed since, and is the only request made without a local
    // change to send.
    void run()

    const unsubscribeStores = subscribeLibrary(onChanged)
    const unsubscribePlayback = subscribeStore(PLAYBACK_STORAGE_KEY, onChanged)

    // Both directions of attention matter. Leaving the tab is the last chance
    // to ship a pending change before the browser may freeze or discard the
    // page; coming back answers "what happened on my other device" instantly,
    // without waiting out the poll interval. `visibilitychange` rather than
    // `beforeunload`, which mobile browsers do not reliably fire.
    const onVisibility = () => {
      if (timer.current) clearTimeout(timer.current)
      void run()
    }

    // While somebody is actually reading, keep pulling on a slow tick so another
    // device's activity arrives without them touching anything. The running
    // guard collapses this into the single-flight path every trigger shares,
    // and a poll that finds nothing changed costs one cheap request.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void run()
    }, PULL_INTERVAL_MS)

    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      unsubscribeStores()
      unsubscribePlayback()
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(interval)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pro, run, signedIn])

  // Signing out must not leave a mirror behind: the next person to sign in on
  // this browser would have their first diff compare against somebody else's
  // library and upload the difference as their own.
  useEffect(() => {
    if (signedIn === false) clearSyncState()
  }, [signedIn])

  return { status, syncNow: run }
}
