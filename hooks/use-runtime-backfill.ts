import { useEffect, useState } from 'react'

import type { WatchedItem } from '@/hooks/use-local-storage'

/**
 * Real runtimes for library rows recorded before runtimes were stored.
 *
 * Everything watched from now on carries its own runtime, captured for free at
 * the one moment the page already had it (see `buildWatchedItem`). This is only
 * about the back catalogue, and it is deliberately cheap enough to be worth it:
 * one POST, no TMDB traffic at all, answered from `watched_media.runtime` which
 * the hourly alert sweep already writes for every watchlisted title on the site.
 *
 * Failure is a non-event. Offline, signed out, not a supporter, endpoint down:
 * the map stays empty, `computeStats` falls back to its averages, and the panel
 * says "roughly" exactly as it always did. Nothing here is allowed to be the
 * reason the stats page shows an error, because the stats page works fine
 * without it.
 */

/** Matches MAX_KEYS in lib/stats/routes.ts. Asking for more is silently ignored. */
const MAX_KEYS = 400

export function useRuntimeBackfill(
  pro: boolean,
  completed: WatchedItem[]
): Record<string, number> | undefined {
  const [runtimes, setRuntimes] = useState<Record<string, number>>()

  // The list of keys that still need one, as a stable string, so this fires
  // when the SET of missing runtimes changes and not on every array identity
  // change — ticking an episode off rewrites `completed` on every click.
  const missing = completed
    .filter((item) => !item.runtime)
    .map((item) => `${item.type}:${item.id}`)
  const wanted = [...new Set(missing)].slice(0, MAX_KEYS).sort()
  const signature = wanted.join(',')

  useEffect(() => {
    if (!pro || !signature) return
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch('/api/stats/runtimes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: signature.split(',') }),
        })
        if (!response.ok) return
        const body = await response.json()
        if (cancelled || !body?.success) return
        setRuntimes(body.runtimes ?? {})
      } catch {
        // Deliberately silent. See the note above.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pro, signature])

  return runtimes
}
