'use client'

import * as React from 'react'
import { Copy, QrCode, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiError, togetherBeatApi, togetherStateApi } from '@/lib/api-client'
import { parseEmbedProgress } from '@/lib/embed-progress'
import { formatPlaybackTime } from '@/lib/playback-positions'
import {
  followHost,
  inviteHref,
  planRemoteCommand,
  remoteHref,
} from '@/lib/watch-together'

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

const hostRoleLabel = (isHost: boolean, ended: boolean) => {
  if (isHost) return ' · you control playback'
  if (ended) return ' · the room has ended'
  return ' · following the host'
}

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

  // Where the host is, in words, for the guest. On an embed we can read the
  // room but not steer it — the provider accepts nothing back — so the number
  // IS the feature there: you can match it by hand.
  const [hostAt, setHostAt] = React.useState<number | null>(null)

  // Rooms are swept, so a guest can outlive one. Polling a 404 every four
  // seconds forever is a Worker invocation buying nothing, and the guest is
  // left reading "following the host" about a room that no longer exists.
  const [ended, setEnded] = React.useState(false)

  // Phone-as-remote QR dialog (host only).
  const [remoteOpen, setRemoteOpen] = React.useState(false)

  // The newest remote command the host loop has already drained. Commands are
  // one-shot: `cmd_at` older than this ref means "applied, do not re-apply".
  const appliedCmd = React.useRef(0)

  // Steering a frame, for both loops below. Hoisted so the host and guest
  // effects share one function instead of closing over their own copy.
  const push = React.useCallback(
    (position: number, playing: boolean) => {
      frameRef.current?.contentWindow?.postMessage(
        {
          source: TOGETHER_SOURCE,
          kind: playing ? 'play' : 'pause',
          t: position,
        },
        '*'
      )
    },
    [frameRef]
  )

  // Host: tick playback to D1, and drain any pending phone command first.
  React.useEffect(() => {
    if (!isHost || ended) return
    const id = setInterval(async () => {
      if (document.hidden) return
      // Drain a remote command before writing our own beat: the phone's
      // absolute position/playing IS the next beat, so applying it here and
      // skipping the write keeps D1 and the frame in step with one round-trip.
      try {
        const state = await togetherStateApi(code)
        const cmd =
          state.cmd_at != null
            ? {
                position: state.cmd_position ?? state.position,
                playing: !!state.cmd_playing,
                updatedAt: state.cmd_at,
              }
            : null
        const plan = planRemoteCommand(cmd, appliedCmd.current, Date.now())
        if (plan && state.cmd_at != null) {
          appliedCmd.current = state.cmd_at
          push(plan.position, plan.playing)
          // Let the next tick write the beat the command produced; forcing a
          // write here would race the frame's own progress report.
          return
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setEnded(true)
          return
        }
        // Any other failure falls through to the local-beat write below.
      }
      const beat = latest.current
      if (!beat) return
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
  }, [code, isHost, ended, push])

  // The last host beat this guest actually acted on. A player that reports
  // nothing back (an embed, or the house player before its first tick) leaves
  // `latest` null forever, so every poll re-decides to follow and re-seeks the
  // frame to the same spot every four seconds. Acting once per beat is enough:
  // a playing host stamps a new one every 4s, so drift correction is unchanged.
  const acted = React.useRef<number>(0)

  React.useEffect(() => {
    if (isHost || ended) return
    // Steering needs a player; knowing where the room is does not.
    const sync = async () => {
      // A hidden tab is nobody watching, so it is the one poll worth
      // skipping. A guest who has not pressed play still polls: the host's
      // position and "the room has ended" are the whole reason they opened the
      // invite, and gating on the player meant neither ever appeared.
      if (document.hidden) return
      try {
        const beat = await togetherStateApi(code)
        setHostAt(beat.position)
        const follow = followHost(
          {
            position: beat.position,
            playing: !!beat.playing,
            updatedAt: beat.updated_at,
          },
          latest.current,
          Date.now()
        )
        if (follow && beat.updated_at !== acted.current) {
          acted.current = beat.updated_at
          push(follow.position, follow.playing)
        }
      } catch (error) {
        // A 404 is the room being gone for good; anything else is one bad poll
        // (offline, a 503 from D1) and the next one can still succeed.
        if (error instanceof ApiError && error.status === 404) setEnded(true)
      }
    }
    void sync()
    const id = setInterval(() => void sync(), 4000)
    return () => clearInterval(id)
  }, [code, isHost, ended, push])

  return (
    <div
      data-testid="together-bar"
      // `watch-together-bar` is a styling hook: on a landscape phone the stage
      // gives up the band this bar's `top-16` was measured against, so
      // styles/globals.css moves it to the top edge there.
      className="watch-together-bar absolute inset-x-0 top-16 z-50 flex items-center justify-center gap-2 border-b border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-foreground"
    >
      <Users className="size-3.5 shrink-0" />
      {/* min-w-0 + truncate, or the role text pushes the copy button off the
          right edge of a phone - which is where the invite lives. */}
      <span className="min-w-0 truncate">
        Watch Together · <span className="font-mono font-bold">{code}</span>
        {hostRoleLabel(isHost, ended)}
      </span>
      {/* Outside the truncating span on purpose: on a phone this is the first
          thing the line would eat, and for a guest on an embed - which takes no
          steering - it is the only way to match the room by hand. */}
      {!isHost && !ended && hostAt ? (
        <span className="shrink-0 font-mono opacity-80">
          {formatPlaybackTime(hostAt)}
        </span>
      ) : null}
      {/* The phone remote: host-only, and pointless once the room has ended.
          Opens a QR whose payload is the invite URL with remote=1, which the
          detail hero reads to mount the pad instead of this bar. */}
      {isHost && !ended ? (
        <button
          type="button"
          onClick={() => setRemoteOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 font-medium transition hover:border-primary/60"
        >
          <QrCode className="size-3" aria-hidden />
          Remote
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          // inviteHref drops `host=1`: an invitee opening this URL must poll
          // as a guest, not spin up a second host loop fighting over the beat.
          void navigator.clipboard?.writeText(inviteHref(location.href))
          toast('Invite link copied')
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 font-medium transition hover:border-primary/60"
      >
        <Copy className="size-3" aria-hidden />
        Copy link
      </button>
      <Dialog open={remoteOpen} onOpenChange={setRemoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Use your phone as the remote</DialogTitle>
            <DialogDescription>
              Scan with your camera. The pad controls playback on this screen.
            </DialogDescription>
          </DialogHeader>
          {/* White plate so the code scans on any theme — the module sits over
              the player, where a transparent code has no quiet zone. */}
          <div className="rounded-md bg-white p-3">
            <QRCodeSVG
              value={remoteHref(location.href)}
              size={192}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>
          <p className="text-center font-mono text-xs opacity-80">
            Room {code}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
