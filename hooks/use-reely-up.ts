'use client'

import { useEffect, useState } from 'react'

import { RICH_SOURCE } from '@/config/sources'

/**
 * Can the Reely Player play right now? The browser half of
 * lib/pro/relay-health.ts: one GET /api/stream/health per page load, shared by
 * every caller (the source choice, the switcher, the /pro benefits).
 *
 * Fails OPEN: a network error or an odd answer reads as "up", because the
 * ticket route refuses on the same server answer anyway and the player's own
 * fallback then plays the next server. Failing closed would take the player
 * away from every supporter whenever this one request hiccups.
 */
let pending: Promise<boolean> | null = null

/** The parsed answer: only an explicit `up: false` is down. */
export const reelyUpFrom = (body: unknown): boolean =>
  (body as { up?: unknown } | null)?.up !== false

export const fetchReelyUp = (): Promise<boolean> => {
  pending ??= fetch('/api/stream/health')
    .then((res) => (res.ok ? res.json() : null))
    .then(reelyUpFrom)
    .catch(() => true)
  return pending
}

/**
 * `true` until the answer lands (and forever on a deployment without the
 * player, which never asks). A late `false` moves the source choice off the
 * player; the ticket route covers a play that started before it arrived.
 *
 * ponytail: asked once per page load. A relay that dies mid-visit is caught by
 * the ticket route and the player's own fallback, not here; poll only if
 * outages start landing mid-session.
 */
export function useReelyUp(): boolean {
  const [up, setUp] = useState(true)
  useEffect(() => {
    if (!RICH_SOURCE) return
    let live = true
    void fetchReelyUp().then((value) => {
      if (live) setUp(value)
    })
    return () => {
      live = false
    }
  }, [])
  return up
}
