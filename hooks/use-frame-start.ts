'use client'

import React from 'react'

export interface LatchedStart {
  identity: string | null
  start: number | null
}

/**
 * Keep `prev` while the frame is the same one; read a new start only when the
 * frame changes. Pure, so the one property that matters is pinned by a test:
 * the read happens once per frame, never per render.
 */
export const latchStart = (
  prev: LatchedStart,
  identity: string | null,
  read: () => number | null
): LatchedStart =>
  prev.identity === identity
    ? prev
    : { identity, start: identity ? read() : null }

/**
 * The second an embed frame starts at, fixed for the life of that frame.
 *
 * The start rides the frame's URL, so it must not move while the frame plays:
 * the progress bridge writes the position every few seconds, and a URL that
 * read it live would reload the embed on every write. It is read again only
 * when `identity` changes — another episode, another server — which is exactly
 * when the frame is re-pointed anyway. `null` identity means nothing is playing.
 */
export function useFrameStart(
  identity: string | null,
  read: () => number | null
): number | null {
  const [latched, setLatched] = React.useState<LatchedStart>({
    identity: null,
    start: null,
  })
  const next = latchStart(latched, identity, read)
  // The "adjust state while rendering" pattern: React re-renders straight away
  // with the new value, before anything is committed with the old one.
  if (next !== latched) setLatched(next)
  return next.start
}
