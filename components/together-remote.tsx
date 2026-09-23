'use client'

import * as React from 'react'
import { Pause, Play, RotateCcw, RotateCw, Smartphone } from 'lucide-react'
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

/** The pad's one big reading: where the film is, or why there is no answer. */
const padReadout = (
  beat: { position: number } | null,
  ended: boolean
): string => {
  if (ended) return 'Room ended'
  if (!beat) return 'Connecting…'
  return formatPlaybackTime(beat.position)
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

  // The fixed bottom widgets (install nudge, tip jar) would sit under the pad's
  // thumb zone; styles/globals.css hides them and pads the page while it is up.
  React.useEffect(() => {
    document.body.dataset.remoteOpen = '1'
    return () => {
      delete document.body.dataset.remoteOpen
    }
  }, [])

  const position = beat?.position ?? 0
  const disabled = !beat || ended

  // A remote, shaped like one: this device exists to press three buttons, so
  // they sit where a thumb rests — a sheet on the bottom edge, safe-area
  // padded — at a size nobody misses, with the one reading that matters
  // (where the film is) large enough to check at arm's length.
  return (
    <section
      data-testid="together-remote"
      aria-label="Remote control"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/85 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Smartphone className="size-3.5 shrink-0" aria-hidden />
          Remote for room
          <span className="font-mono font-semibold text-foreground">
            {code}
          </span>
        </p>
        <p
          aria-live="polite"
          className="text-3xl font-semibold tracking-tight tabular-nums"
        >
          {padReadout(beat, ended)}
        </p>
        <div className="flex items-center gap-7">
          <SkipButton
            direction="back"
            disabled={disabled}
            onPress={() =>
              void send(Math.max(0, position - SKIP_S), !!beat?.playing)
            }
          />
          <button
            type="button"
            aria-label={beat?.playing ? 'Pause' : 'Play'}
            disabled={disabled}
            onClick={() => void send(position, !beat?.playing)}
            className="grid size-20 place-items-center rounded-full bg-primary-fill text-primary-foreground shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.7)] transition-transform duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            {beat?.playing ? (
              <Pause className="size-8 fill-current" aria-hidden />
            ) : (
              <Play
                className="size-8 translate-x-0.5 fill-current"
                aria-hidden
              />
            )}
          </button>
          <SkipButton
            direction="forward"
            disabled={disabled}
            onPress={() => void send(position + SKIP_S, !!beat?.playing)}
          />
        </div>
      </div>
    </section>
  )
}

/** Seconds per skip press — the number drawn inside the skip glyphs. */
const SKIP_S = 10

/** ↺ 10 / ↻ 10: the skip glyph every video app has taught people to read. */
function SkipButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'back' | 'forward'
  disabled: boolean
  onPress: () => void
}) {
  const Icon = direction === 'back' ? RotateCcw : RotateCw
  return (
    <button
      type="button"
      aria-label={
        direction === 'back'
          ? `Back ${SKIP_S} seconds`
          : `Forward ${SKIP_S} seconds`
      }
      disabled={disabled}
      onClick={onPress}
      className="relative grid size-14 place-items-center rounded-full border border-white/15 bg-white/5 transition-transform duration-150 active:scale-95 disabled:opacity-40"
    >
      <Icon className="size-7" strokeWidth={1.75} aria-hidden />
      <span
        aria-hidden
        className="absolute pt-px text-[10px] font-bold tabular-nums"
      >
        {SKIP_S}
      </span>
    </button>
  )
}
