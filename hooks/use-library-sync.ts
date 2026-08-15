'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  clearSyncState,
  subscribeLibrary,
  syncOnce,
  type SyncStatus,
} from '@/lib/library-sync'
import { useAccount } from '@/hooks/use-account'
import { writeStore } from '@/hooks/use-local-storage'

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

    // Once on mount: this is what restores the library on a new device, and it
    // is the only request this hook makes without a change to send.
    void run()

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void run(), DEBOUNCE_MS)
    }

    const unsubscribe = subscribeLibrary(schedule)

    // Leaving the tab is the last chance to ship a pending change before the
    // browser may freeze or discard the page. `visibilitychange` rather than
    // `beforeunload`, which mobile browsers do not reliably fire.
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      if (timer.current) clearTimeout(timer.current)
      void run()
    }
    document.addEventListener('visibilitychange', onHidden)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onHidden)
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
