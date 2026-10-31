'use client'

import * as React from 'react'

import { REELY_SOURCE_ID } from '@/config/sources'
import {
  trackPlaybackFinished,
  trackPlayerFailed,
  trackPlayerIncident,
  trackPlayerStreamPath,
} from '@/lib/analytics'
import { STREAM_EMBED_ALLOW } from '@/lib/embed-policy'
import {
  clearPosition,
  isFinishedAt,
  playbackKey,
  writePosition,
} from '@/lib/playback-positions'
import { prefsFromPlayer, writePlaybackPrefs } from '@/lib/playback-prefs'
import {
  incidentFrom,
  mayLeavePlayer,
  playbackAdvanced,
} from '@/lib/player-hop'
import { takeTicket } from '@/lib/pro/ticket-cache'
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
 *   { source:'reely-player', kind:'prefs', sub?, quality? }
 *       -> a subtitle or quality picked IN the player, saved like any setting
 *          so the next title boots with it
 *
 * `onReady` fires when the shell has loaded (the switcher's stall detector
 * uses it); `onUnavailable` when no ticket can be minted — 402 once the free
 * title is spent elsewhere, or the worker not configured — and the hero falls
 * back to the embed servers.
 */
export function ReelyPlayer({
  target,
  onReady,
  onUnavailable,
  onEnded,
  onFinished,
  frameRef: exposedRef,
}: {
  target: SelfHostTarget
  onReady: () => void
  onUnavailable: (via?: 'switcher' | 'stall_auto') => void
  /**
   * The title played to the end. Series pages use it to start the next episode
   * when the account asks for that (`prefs.autoNext`); everything else ignores
   * it and the stored position is cleared either way.
   */
  onEnded?: () => void
  /**
   * The title is watched: it ended, or played past the credits threshold
   * (lib/playback-positions isFinishedAt). Fires once per mount. Series pages
   * tick the episode off with it, which is what moves "continue" on to the
   * next one; most people close the tab during the credits and never see
   * `ended` at all.
   */
  onFinished?: () => void
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
  // In a ref so the message listener below does not have to be torn down and
  // rebuilt every time the parent re-renders with a fresh closure. The effect
  // is keyed on the URL, and re-running it mid-playback would drop messages.
  const endedRef = React.useRef(onEnded)
  React.useEffect(() => {
    endedRef.current = onEnded
  }, [onEnded])
  // Same reason, for the give-up path: the player can now say the provider
  // inside it failed, and that has to reach the hero without rebuilding the
  // listener on every render.
  const unavailableRef = React.useRef(onUnavailable)
  React.useEffect(() => {
    unavailableRef.current = onUnavailable
  }, [onUnavailable])
  const finishedRef = React.useRef(onFinished)
  React.useEffect(() => {
    finishedRef.current = onFinished
  }, [onFinished])
  // Once per mount: progress keeps arriving through the credits.
  const finishedSent = React.useRef(false)
  const finish = React.useCallback(() => {
    if (finishedSent.current) return
    finishedSent.current = true
    trackPlaybackFinished({
      media_id: target.id,
      media_type: target.type === 'movie' ? 'movie' : 'tv',
      source: 'reely-player',
    })
    finishedRef.current?.()
  }, [target.id, target.type])

  const key = `${target.type}:${target.id}:${target.season ?? ''}:${target.episode ?? ''}`

  React.useEffect(() => {
    if (requested.current) return
    requested.current = true

    void (async () => {
      try {
        const warmed = await takeTicket(target)
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

    // Reely's own evidence that this stream played, per mounted URL. It does not
    // take the player's word for it: see lib/player-hop.ts.
    let lastProgress: number | undefined
    let sawPlayback = false

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== playerOrigin) return
      if (event.source !== frameRef.current?.contentWindow) return
      const data = event.data as
        | {
            source?: string
            kind?: string
            t?: number
            dur?: number
            native?: boolean
            played?: boolean
            chosen?: boolean
            step?: unknown
            sub?: unknown
            quality?: unknown
          }
        | undefined
      if (!data || data.source !== 'reely-player') return
      const pKey = playbackKey(
        target.type,
        target.id,
        target.season,
        target.episode
      )
      if (data.kind === 'progress' && Number.isFinite(data.t)) {
        if (playbackAdvanced(lastProgress, data.t as number)) sawPlayback = true
        lastProgress = data.t as number
        const duration = Number.isFinite(data.dur)
          ? (data.dur as number)
          : undefined
        writePosition(pKey, data.t as number, duration)
        if (isFinishedAt(data.t as number, duration)) finish()
      } else if (data.kind === 'ended') {
        clearPosition(pKey)
        finish()
        endedRef.current?.()
      } else if (data.kind === 'prefs') {
        // No reload: the player has already applied it. This is only so the
        // NEXT boot - next episode, next title, another device - starts there.
        const patch = prefsFromPlayer(data)
        if (patch) void writePlaybackPrefs(patch)
      } else if (data.kind === 'capability') {
        // Counts the one thing that decides what a viewer costs us. See
        // trackPlayerStreamPath — this is how a platform change that frees a
        // whole browser family announces itself.
        trackPlayerStreamPath({ native: data.native === true })
      } else if (data.kind === 'incident') {
        const incident = incidentFrom(data)
        if (incident) trackPlayerIncident(incident)
      } else if (data.kind === 'unavailable') {
        // The player booted, and then whatever it framed could not play. Until
        // it could say so, this was the one failure the switcher's stall
        // detector could not see either: our shell paints in about 200ms, so
        // `load` fires, `loaded` goes true, and the nine-second timer that
        // moves a visitor off a dead provider never starts. The result was a
        // black rectangle with no warning and no automatic hop — on the one
        // source that supporters are given by default.
        const viewerChose = data.chosen === true
        const played = sawPlayback || data.played === true
        const moved = mayLeavePlayer({ sawPlayback: played, viewerChose })
        if (failed.current) return
        trackPlayerFailed({
          source: REELY_SOURCE_ID,
          reason: 'unavailable',
          played,
          viewer_chose: viewerChose,
          moved,
        })
        if (moved) {
          failed.current = true
          unavailableRef.current(viewerChose ? 'switcher' : 'stall_auto')
        }
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
      // The same grant every other embed on the site gets, from the same
      // builder. It used to be a hand-written list here, which meant this frame
      // silently missed the ad-tech denials (`browsing-topics`,
      // `attribution-reporting`, the Protected Audience pair) that the rest of
      // the site withholds — and the house player nests a provider inside
      // itself, so a permission missing at this level is missing two levels
      // down as well. See lib/embed-policy.ts.
      allow={STREAM_EMBED_ALLOW}
      onLoad={onReady}
      title="Reely Player"
    />
  )
}
