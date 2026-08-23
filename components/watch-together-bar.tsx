'use client'

import * as React from 'react'
import { Users } from 'lucide-react'

import { togetherBeatApi, togetherStateApi } from '@/lib/api-client'

// The Watch Together sync loop, mounted inside the player area of a detail
// page when the URL carries ?watch=CODE.
//
// Host: the player frame ticks `time` messages out (reely-player); this bar
// relays the newest one to D1 every 4s.
// Guest: polls D1 every 4s and pushes the host's position INTO the player
// frame (reely-parent seek/play/pause) when it drifts more than 3s.

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
      if (!data || data.source !== 'reely-player') return
      latest.current = {
        position: typeof data.t === 'number' ? data.t : 0,
        playing: !!data.playing,
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  React.useEffect(() => {
    if (!isHost) return
    const id = setInterval(() => {
      const beat = latest.current
      if (!beat) return
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
      try {
        const beat = await togetherStateApi(code)
        const drift = Math.abs(beat.position - (latest.current?.position ?? 0))
        if (drift > 3) push(beat.position, !!beat.playing)
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
      className="bg-primary/10 border-primary/40 text-foreground absolute inset-x-0 top-16 z-50 flex items-center justify-center gap-2 border-b py-1.5 text-xs"
    >
      <Users className="size-3.5" />
      <span>
        Watch Together · <span className="font-mono font-bold">{code}</span>
        {isHost ? ' — you control playback' : ' — following the host'}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(location.href)
        }}
        className="underline"
      >
        Copy link
      </button>
    </div>
  )
}
