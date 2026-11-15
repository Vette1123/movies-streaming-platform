'use client'

import { useEffect, useState } from 'react'

import { RICH_SOURCE } from '@/config/sources'

/**
 * Can the Reely Player play right now? The browser half of
 * lib/pro/relay-health.ts: one GET /api/stream/health per page load, shared by
 * every caller (the source choice, the switcher, the /pro benefits).
 *
 * The question is per title, because the two halves play differently: a title
 * in our own library (tier 0) carries no relay hop at all and plays while the
 * relay is shut out, while a provider-bound title needs the relay's walk. The
 * Worker composes the two facts server-side when the health call names a title
 * (`?ty=movie&id=550`); the bare question stays the relay's answer alone.
 *
 * Fails OPEN: a network error or an odd answer reads as "up", because the
 * ticket route refuses on the same server answer anyway and the player's own
 * fallback then plays the next server. Failing closed would take the player
 * away from every supporter whenever this one request hiccups.
 */
const pending = new Map<string, Promise<boolean>>()

/** The parsed answer: only an explicit `up: false` is down. */
export const reelyUpFrom = (body: unknown): boolean =>
  (body as { up?: unknown } | null)?.up !== false

/**
 * The health URL for a title. `mediaKey` is the site's own vocabulary
 * (`movie:550`, `series:1399`); the Worker's rule is the player's (`tv` for a
 * show). Anything unparsable asks the bare relay question.
 */
export const healthUrlFor = (mediaKey?: string): string => {
  const [type, id] = (mediaKey ?? '').split(':')
  const numeric = /^\d+$/.test(id ?? '')
  if (type === 'movie' && numeric) return `/api/stream/health?ty=movie&id=${id}`
  if (type === 'series' && numeric) return `/api/stream/health?ty=tv&id=${id}`
  return '/api/stream/health'
}

export const fetchReelyUp = (mediaKey?: string): Promise<boolean> => {
  const key = mediaKey ?? 'relay'
  const hit = pending.get(key)
  if (hit) return hit
  const answer = fetch(healthUrlFor(mediaKey))
    .then((res) => (res.ok ? res.json() : null))
    .then(reelyUpFrom)
    .catch(() => true)
  // Bounded by titles visited; a long session holds dozens of resolved
  // booleans, so the cap is hygiene, not a live limit.
  if (pending.size > 50) pending.clear()
  pending.set(key, answer)
  return answer
}

/**
 * `true` until the answer lands (and forever on a deployment without the
 * player, which never asks). A late `false` moves the source choice off the
 * player; the ticket route covers a play that started before it arrived.
 *
 * ponytail: asked once per page load per title. A relay that dies mid-visit is
 * caught by the ticket route and the player's own fallback, not here; poll
 * only if outages start landing mid-session.
 */
export function useReelyUp(mediaKey?: string): boolean {
  const [up, setUp] = useState(true)
  useEffect(() => {
    if (!RICH_SOURCE) return
    let live = true
    void fetchReelyUp(mediaKey).then((value) => {
      if (live) setUp(value)
    })
    return () => {
      live = false
    }
  }, [mediaKey])
  return up
}
