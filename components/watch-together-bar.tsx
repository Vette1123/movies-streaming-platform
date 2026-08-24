'use client'

import * as React from 'react'
import { Copy, Users } from 'lucide-react'
import { toast } from 'sonner'

import { togetherBeatApi, togetherStateApi } from '@/lib/api-client'
import { parseEmbedProgress } from '@/lib/embed-progress'
import { followHost } from '@/lib/watch-together'

// The Watch Together sync loop, mounted inside the player area of a detail
// page when the URL carries ?watch=CODE.
//
// Host: whichever surface is playing ticks its position out — the house
// player as `reely-player` messages, a third-party embed in the envelope
// lib/embed-progress.ts already knows how to read — and this bar relays the
// newest one to D1 every 4s.
// Guest: polls D1 every 4s and steers the player frame (seek/play/pause) when
// lib/watch-together.ts says to.
//
// Only the house player takes steering: an embed publishes its position but
// accepts nothing back, so a guest watching on an embed sees the room's state
// and stays where they are. Hosting from one works fine.

export const TOGETHER_SOURCE = 'reely-together'

interface WatchTogetherBarProps {
  code: string
  isHost: boolean
  frameRef: React.RefObject<HTMLIFrameElement | null>
}

export function WatchTogetherBar({
  code,
  isHost,
  frameRef,
}: WatchTogetherBarProps) {
  const latest = React.useRef<{ position: number; playing: boolean } | null>(
    null
  )

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data
      if (data && data.source === 'reely-player') {
        latest.current = {
          position: typeof data.t === 'number' ? data.t : 0,
          playing: !!data.playing,
        }
        return
      }
      // The embed's own stream, through the parser the progress bridge uses.
      // Without this branch a host watching on an embed sent no beats at all
      // and the room simply never moved.
      const progress = parseEmbedProgress(data)
      if (!progress) return
      latest.current = {
        position: progress.positionSeconds,
        // A clock that is moving is a film that is playing; `ended` is the
        // only stop these envelopes carry.
        playing: progress.kind === 'progress',
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Both loops below are the only recurring Worker traffic on a detail page, so
  // they skip the two cases that cost an invocation and buy nothing: a hidden
  // tab (nobody is watching it), and a position that has not moved since the
  // last beat (a paused film would otherwise write the same row every 4s for as
  // long as the tab stayed open).
  const sent = React.useRef<{ position: number; playing: boolean } | null>(null)

  React.useEffect(() => {
    if (!isHost) return
    const id = setInterval(() => {
      const beat = latest.current
      if (!beat || document.hidden) return
      const last = sent.current
      if (
        last &&
        last.playing === beat.playing &&
        Math.abs(last.position - beat.position) < 0.5
      ) {
        return
      }
      sent.current = beat
      void togetherBeatApi({
        code,
        position: beat.position,
        playing: beat.playing,
      }).catch(() => undefined)
    }, 4000)
    return () => clearInterval(id)
  }, [code, isHost])

  React.useEffect(() => {
    if (isHost) return
    const push = (position: number, playing: boolean) => {
      frameRef.current?.contentWindow?.postMessage(
        {
          source: TOGETHER_SOURCE,
          kind: playing ? 'play' : 'pause',
          t: position,
        },
        '*'
      )
    }
    const sync = async () => {
      // Nothing to steer until the player is on screen, and a poll that can
      // only be discarded is a Worker invocation spent on nothing.
      if (document.hidden || !frameRef.current) return
      try {
        const beat = await togetherStateApi(code)
        const follow = followHost(
          {
            position: beat.position,
            playing: !!beat.playing,
            updatedAt: beat.updated_at,
          },
          latest.current,
          Date.now()
        )
        if (follow) push(follow.position, follow.playing)
      } catch {
        // A 404 means the room was swept - guests just stop syncing.
      }
    }
    void sync()
    const id = setInterval(() => void sync(), 4000)
    return () => clearInterval(id)
  }, [code, isHost, frameRef])

  return (
    <div
      data-testid="together-bar"
      className="bg-primary/10 border-primary/40 text-foreground absolute inset-x-0 top-16 z-50 flex items-center justify-center gap-2 border-b px-3 py-1.5 text-xs"
    >
      <Users className="size-3.5 shrink-0" />
      {/* min-w-0 + truncate, or the role text pushes the copy button off the
          right edge of a phone - which is where the invite lives. */}
      <span className="min-w-0 truncate">
        Watch Together · <span className="font-mono font-bold">{code}</span>
        {isHost ? ' · you control playback' : ' · following the host'}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(location.href)
          toast('Invite link copied')
        }}
        className="hover:border-primary/60 inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 font-medium transition"
      >
        <Copy className="size-3" aria-hidden />
        Copy link
      </button>
    </div>
  )
}
