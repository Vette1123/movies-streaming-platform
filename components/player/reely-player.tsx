'use client'

import * as React from 'react'

import {
  clearPosition,
  playbackKey,
  readPosition,
  resumableSeconds,
  writePosition,
} from '@/lib/playback-positions'
import { readPlaybackPrefs } from '@/lib/playback-prefs'
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
}: {
  target: SelfHostTarget
  onReady: () => void
  onUnavailable: () => void
}) {
  const [url, setUrl] = React.useState<string | null>(null)
  const requested = React.useRef(false)
  const failed = React.useRef(false)
  const frameRef = React.useRef<HTMLIFrameElement>(null)

  const key = `${target.type}:${target.id}:${target.season ?? ''}:${target.episode ?? ''}`

  React.useEffect(() => {
    if (requested.current) return
    requested.current = true

    const pKey = playbackKey(target.type, target.id, target.season, target.episode)
    const start = resumableSeconds(readPosition(pKey))

    void (async () => {
      try {
        const res = await fetch('/api/pro/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: target.type,
            id: target.id,
            ...(target.type === 'tv'
              ? { season: target.season ?? 1, episode: target.episode ?? 1 }
              : {}),
            title: target.title ?? '',
            ...(target.year ? { year: target.year } : {}),
            start,
            // Applied by the player on boot; read synchronously from the
            // local mirror so no account round trip delays first play.
            playback: readPlaybackPrefs(),
          }),
        })
        if (!res.ok) throw new Error(`ticket ${res.status}`)
        const data = (await res.json()) as { url?: string }
        if (!data.url) throw new Error('no url')
        setUrl(data.url)
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
        | { source?: string; kind?: string; t?: number; dur?: number }
        | undefined
      if (!data || data.source !== 'reely-player') return
      const pKey = playbackKey(
        target.type,
        target.id,
        target.season,
        target.episode,
      )
      if (data.kind === 'progress' && Number.isFinite(data.t)) {
        writePosition(
          pKey,
          data.t as number,
          Number.isFinite(data.dur) ? (data.dur as number) : undefined,
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
