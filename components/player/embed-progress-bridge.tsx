'use client'

import React from 'react'

import {
  parseEmbedProgress,
  shouldWriteEmbedProgress,
} from '@/lib/embed-progress'
import {
  clearPosition,
  playbackKey,
  writePosition,
} from '@/lib/playback-positions'

/**
 * Feeds the playback-position store from a third-party embed's postMessage
 * stream, so continue-watching and resume work the same when an embed plays
 * as they do on the house player.
 *
 * Trust is derived exactly like components/player/reely-player.tsx does it,
 * and never from a hard-coded host:
 *   - the message's origin must equal the CURRENT frame URL's origin, and
 *   - the message must come from that frame's own contentWindow.
 * A provider that publishes no events simply never matches, which costs one
 * no-op listener per playing page.
 *
 * Mounted by DetailsHero next to the embed iframe, only while something is
 * actually playing (the listener exists only when there is a frame to hear).
 */
export const EmbedProgressBridge = ({
  src,
  type,
  id,
  season,
  episode,
  frameRef,
}: {
  /** The embed URL currently loaded. Empty = nothing playing, no listener. */
  src?: string
  type: 'movie' | 'tv'
  id: number
  season?: number
  episode?: number
  frameRef: React.RefObject<HTMLIFrameElement | null>
}) => {
  React.useEffect(() => {
    if (!src) return

    let playerOrigin: string
    try {
      playerOrigin = new URL(src).origin
    } catch {
      return
    }

    // Last position we actually persisted, for the write throttle. A ref, not
    // state: it changes many times a minute and must never re-render the hero.
    let lastWrittenSeconds: number | null = null

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== playerOrigin) return
      if (event.source !== frameRef.current?.contentWindow) return

      const progress = parseEmbedProgress(event.data)
      if (!progress) return

      const key = playbackKey(type, id, season, episode)
      if (progress.kind === 'ended') {
        clearPosition(key)
        lastWrittenSeconds = null
        return
      }

      // A seek backwards is a real move too — shouldWriteEmbedProgress uses
      // the absolute delta for exactly that reason.
      if (
        !shouldWriteEmbedProgress(progress.positionSeconds, lastWrittenSeconds)
      )
        return
      writePosition(key, progress.positionSeconds, progress.durationSeconds)
      lastWrittenSeconds = progress.positionSeconds
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [src, type, id, season, episode, frameRef])

  return null
}
