'use client'

import * as React from 'react'
import { Pause, Play, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError, togetherRemoteApi, togetherStateApi } from '@/lib/api-client'
import { formatPlaybackTime } from '@/lib/playback-positions'
import { remoteView } from '@/lib/watch-together'

// The phone half of the remote: the host scans a QR on their phone, this pad
// opens with ?remote=1, and every press writes a one-shot command to D1 that
// the host loop (watch-together-bar) drains into the player. There is no
// direct phone→player channel — the host tab is the only surface with a
// frame to steer.
//
// Ceiling (documented in the lesson): the command only reaches the house
// player; an embed accepts nothing back, so a host streaming from a third-party
// server sees the room but the buttons do nothing.
interface TogetherRemoteProps {
  code: string
  /** The host's capability, from the QR — the Worker refuses a press without it. */
  remoteKey: string
}

const remoteStatus = (
  beat: { position: number } | null,
  ended: boolean
): string => {
  if (ended) return ' · the room has ended'
  if (!beat) return ' · connecting…'
  return ` · ${formatPlaybackTime(beat.position)}`
}

export function TogetherRemote({ code, remoteKey }: TogetherRemoteProps) {
  const [beat, setBeat] = React.useState<{
    position: number
    playing: boolean
  } | null>(null)
  const [ended, setEnded] = React.useState(false)

  const send = React.useCallback(
    async (position: number, playing: boolean) => {
      // A remote you cannot feel is a remote you press twice.
      navigator.vibrate?.(10)
      // Optimistic: the pad should feel instant even though the host polls
      // every 4s. The next poll reconciles whatever the host actually applied.
      setBeat({ position, playing })
      try {
        await togetherRemoteApi({ code, key: remoteKey, position, playing })
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setEnded(true)
          return
        }
        toast('Could not reach the room')
      }
    },
    [code, remoteKey]
  )

  React.useEffect(() => {
    // A swept room stays swept: polling its 404 every 4s buys nothing.
    if (ended) return
    let cancelled = false
    const sync = async () => {
      // A hidden phone tab is nobody holding the remote — same rule the host
      // and guest loops use, so an idle phone costs zero invocations.
      if (document.hidden) return
      try {
        const state = await togetherStateApi(code)
        if (cancelled) return
        setBeat(remoteView(state, state.now ?? Date.now()))
      } catch (error) {
        if (!cancelled && error instanceof ApiError && error.status === 404) {
          setEnded(true)
        }
      }
    }
    void sync()
    const id = setInterval(() => void sync(), 4000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [code, ended])

  const position = beat?.position ?? 0
  const disabled = !beat || ended

  return (
    <div
      data-testid="together-remote"
      className="watch-together-bar absolute inset-x-0 top-16 z-50 flex items-center justify-center gap-2 border-b border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-foreground"
    >
      <Smartphone className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate" aria-live="polite">
        Remote · <span className="font-mono font-bold">{code}</span>
        {remoteStatus(beat, ended)}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label="Back 10 seconds"
          disabled={disabled}
          onClick={() => void send(Math.max(0, position - 10), !!beat?.playing)}
          className="tap-target inline-flex items-center rounded-full border border-white/15 px-2 py-0.5 font-mono font-medium transition hover:border-primary/60 disabled:opacity-40"
        >
          -10
        </button>
        <button
          type="button"
          aria-label={beat?.playing ? 'Pause' : 'Play'}
          disabled={disabled}
          onClick={() => void send(position, !beat?.playing)}
          className="tap-target inline-flex items-center rounded-full border border-white/15 px-2 py-0.5 transition hover:border-primary/60 disabled:opacity-40"
        >
          {beat?.playing ? (
            <Pause className="size-3.5" aria-hidden />
          ) : (
            <Play className="size-3.5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          aria-label="Forward 10 seconds"
          disabled={disabled}
          onClick={() => void send(position + 10, !!beat?.playing)}
          className="tap-target inline-flex items-center rounded-full border border-white/15 px-2 py-0.5 font-mono font-medium transition hover:border-primary/60 disabled:opacity-40"
        >
          +10
        </button>
      </div>
    </div>
  )
}
