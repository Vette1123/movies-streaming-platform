'use client'

import * as React from 'react'

import {
  clearPosition,
  playbackKey,
  writePosition,
} from '@/lib/playback-positions'
import { ticketFor } from '@/lib/pro/ticket-cache'
import { type SelfHostTarget } from '@/lib/stream-resolver'

/**
 * The Reely Player: our own playback worker in an iframe.
 *
 * Replaces third-party embeds as the default source. Nothing about the player
 * ships in this bundle — this component exchanges a signed ticket with our
 * worker (`POST /api/pro/ticket`, which enforces session + entitlement) and
 * hands the one-time play URL to a sandboxed page on its own origin that we
 * deploy separately. See the private reely-pro-player repo for that half.
 *
 * Contract with the iframe (postMessage, verified against its origin AND
 * contentWindow so a rogue frame cannot spoof progress):
 *   { source:'reely-player', kind:'progress', t, dur } -> playback store
 *   { source:'reely-player', kind:'ended' }            -> clear position
 *
 * `onReady` fires when the shell has loaded (the switcher's stall detector
 * uses it); `onUnavailable` when no ticket can be minted — 402 once the
 * open-for-everyone window closes, or the worker not configured — and the
 * hero falls back to the embed servers.
 */
export function ReelyPlayer({
  target,
  onReady,
  onUnavailable,
  frameRef: exposedRef,
}: {
  target: SelfHostTarget
  onReady: () => void
  onUnavailable: () => void
  /** Handed out so a Watch Together room can steer THIS frame. The house
   * player is the default source, so without it the guest half of a room was
   * posting into an embed iframe that is not on screen. */
  frameRef?: React.RefObject<HTMLIFrameElement | null>
}) {
  const [url, setUrl] = React.useState<string | null>(null)
  const requested = React.useRef(false)
  const failed = React.useRef(false)
  const ownRef = React.useRef<HTMLIFrameElement>(null)
  const frameRef = exposedRef ?? ownRef

  const key = `${target.type}:${target.id}:${target.season ?? ''}:${target.episode ?? ''}`

  React.useEffect(() => {
    if (requested.current) return
    requested.current = true

    void (async () => {
      try {
        const warmed = await ticketFor(target)
        if (!warmed) throw new Error('no url')
        setUrl(warmed)
      } catch {
        if (!failed.current) {
          failed.current = true
          onUnavailable()
        }
      }
    })()
    // target identity is value-based via key above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  React.useEffect(() => {
    if (!url) return
    let playerOrigin = ''
    try {
      playerOrigin = new URL(url).origin
    } catch {
      return
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== playerOrigin) return
      if (event.source !== frameRef.current?.contentWindow) return
      const data = event.data as
        { source?: string; kind?: string; t?: number; dur?: number } | undefined
      if (!data || data.source !== 'reely-player') return
      const pKey = playbackKey(
        target.type,
        target.id,
        target.season,
        target.episode
      )
      if (data.kind === 'progress' && Number.isFinite(data.t)) {
        writePosition(
          pKey,
          data.t as number,
          Number.isFinite(data.dur) ? (data.dur as number) : undefined
        )
      } else if (data.kind === 'ended') {
        clearPosition(pKey)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key])

  if (!url) return null
  return (
    <iframe
      ref={frameRef}
      src={url}
      className="size-full rounded-md bg-black"
      allowFullScreen
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      onLoad={onReady}
      title="Reely Player"
    />
  )
}
