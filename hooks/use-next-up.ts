'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { subscribeSyncSettled } from '@/lib/library-sync'
import type { NextUpItem } from '@/lib/nextup/routes'
import { PLAYBACK_STORAGE_KEY } from '@/lib/playback-positions'
import { subscribeStore } from '@/hooks/use-local-storage'

export type NextUpState = 'loading' | 'ready' | 'failed'

/**
 * How long a local library edit waits before the queue re-reads the server.
 *
 * Slightly longer than the sync engine's own debounce, so the common path is:
 * tick an episode → sync lands (~2s) → settled signal fires → one refetch that
 * already sees the new rows. This timer is the fallback for paths without a
 * settled signal — another tab's edits arriving over a storage event.
 */
const STORE_REFRESH_DELAY_MS = 2500

/** A beat after "sync landed", so the response that just wrote is readable. */
const SETTLE_DELAY_MS = 300

/**
 * Returning attention re-reads the queue only if it is at least this stale.
 *
 * Tab-switching should never cost a request per switch; the sync-settled path
 * already covers same-device changes, so this exists for "I watched something
 * on my phone ten minutes ago and just came back".
 */
const VISIBLE_THROTTLE_MS = 15_000

/**
 * The up-next queue, kept live.
 *
 * One fetcher shared by the home rail and the account panel, because a queue
 * that only updates on reload is a database view, not a feature. After the
 * first load, every trigger maps to exactly one moment the server's answer
 * could have changed:
 *
 * - **a sync settled** — this device pushed an edit, pulled another device's,
 *   or confirmed there was nothing new. That is the moment to look again.
 * - **a local store changed** — the same data arriving cross-tab through a
 *   storage event, where nobody else's sync will ever notify this tab.
 * - **attention returned** (visible again, or restored from bfcache) — the
 *   cheapest possible "am I current?" check, throttled.
 *
 * No interval, no polling while hidden: requests happen when something happened
 * or when somebody is actually looking.
 */
export function useNextUp(enabled: boolean): {
  state: NextUpState
  items: NextUpItem[]
  started: number
} {
  const [state, setState] = useState<NextUpState>('loading')
  const [items, setItems] = useState<NextUpItem[]>([])
  const [started, setStarted] = useState(0)

  const loadingRef = useRef(false)
  const lastLoadRef = useRef(0)
  const storeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const response = await fetch('/api/next-up')
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        items?: NextUpItem[]
        started?: number
      } | null
      if (!response.ok || !body?.success) {
        setState('failed')
        return
      }
      setItems(body.items ?? [])
      setStarted(body.started ?? 0)
      setState('ready')
      lastLoadRef.current = Date.now()
    } catch {
      setState('failed')
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Same shape as every panel's first load: a fetch is what an effect is
    // for, and the rule only fires because the failure path settles state
    // synchronously before the first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()

    const scheduleWith = (timer: typeof storeTimer, delay: number) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void load(), delay)
    }

    // Two independent fuses, so a failed sync (no settled signal, offline) can
    // never cancel the store-driven retry that would have followed it.
    const offSettled = subscribeSyncSettled((ok) => {
      if (ok) scheduleWith(settleTimer, SETTLE_DELAY_MS)
    })
    const offCompleted = subscribeStore('completedItems', () =>
      scheduleWith(storeTimer, STORE_REFRESH_DELAY_MS)
    )
    const offHistory = subscribeStore('watchedItems', () =>
      scheduleWith(storeTimer, STORE_REFRESH_DELAY_MS)
    )
    const offPositions = subscribeStore(PLAYBACK_STORAGE_KEY, () =>
      scheduleWith(storeTimer, STORE_REFRESH_DELAY_MS)
    )

    // Attention returned. bfcache restores (mobile Back especially) resurrect
    // a frozen page whose data predates wherever the person just was — the one
    // case `persisted` distinguishes from an ordinary load.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastLoadRef.current < VISIBLE_THROTTLE_MS) return
      void load()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      if (Date.now() - lastLoadRef.current < VISIBLE_THROTTLE_MS) return
      void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      offSettled()
      offCompleted()
      offHistory()
      offPositions()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      for (const timer of [storeTimer, settleTimer]) {
        if (timer.current) clearTimeout(timer.current)
      }
    }
  }, [enabled, load])

  return { state, items, started }
}
