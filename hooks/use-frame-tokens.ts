'use client'

import React from 'react'

import { type EmbedTokens } from '@/config/sources'
import { startSecondsFor } from '@/lib/playback-positions'
import { currentPlaybackPrefs } from '@/lib/playback-prefs'

export interface LatchedTokens {
  identity: string | null
  tokens: EmbedTokens | null
}

/**
 * Keep `prev` while the frame is the same one; read again only when the frame
 * changes. Pure, so the one property that matters is pinned by a test: the
 * read happens once per frame, never per render.
 */
export const latchTokens = (
  prev: LatchedTokens,
  identity: string | null,
  read: () => EmbedTokens
): LatchedTokens =>
  prev.identity === identity
    ? prev
    : { identity, tokens: identity ? read() : null }

/** This viewer's playback for one title or episode, as an embed can take it. */
export const readFrameTokens = (
  type: 'movie' | 'tv',
  id: number,
  season?: number,
  episode?: number
): EmbedTokens => ({
  start: startSecondsFor(type, id, season, episode),
  sub: currentPlaybackPrefs().sub ?? null,
})

/**
 * What an embed frame starts with — resume second, subtitle language — fixed
 * for the life of that frame.
 *
 * They ride the frame's URL, so they must not move while it plays: the
 * progress bridge writes the position every few seconds, and a URL that read
 * it live would reload the embed on every write. They are read again only
 * when `identity` changes — another episode, another server — which is exactly
 * when the frame is re-pointed anyway. `null` identity means nothing plays.
 */
export function useFrameTokens(
  identity: string | null,
  read: () => EmbedTokens
): EmbedTokens | null {
  const [latched, setLatched] = React.useState<LatchedTokens>({
    identity: null,
    tokens: null,
  })
  const next = latchTokens(latched, identity, read)
  // The "adjust state while rendering" pattern: React re-renders straight away
  // with the new value, before anything is committed with the old one.
  if (next !== latched) setLatched(next)
  return next.tokens
}
