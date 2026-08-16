'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, Server } from 'lucide-react'

import { HAS_FALLBACK_SOURCE } from '@/config/sources'
import { trackSupportCtaClicked } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { type StreamSourceControl } from '@/hooks/use-stream-source'

/**
 * The escape hatch when a stream will not start.
 *
 * A cross-origin iframe tells the page nothing — no error, no status, no way to
 * ask whether it worked. The only signal available is that `load` never fired,
 * so that is what this is built on: after a grace period with no frame painted,
 * move to the next provider once, automatically, and say so. One hop, never a
 * loop: if the second one is also silent the honest thing is a visible control
 * and an explanation, not an endless carousel of black rectangles.
 *
 * The buttons are always there while something is playing, because the failure
 * this cannot detect — a provider that loads a page and then plays nothing — is
 * common enough that "it loaded" is not the same as "it works".
 */

/**
 * How long to wait before deciding the provider is not coming.
 *
 * Long enough that a slow phone on cellular data is not thrown off a provider
 * that would have worked; short enough that nobody stares at a spinner deciding
 * the site is broken. The spinner is visible for this entire window, so the wait
 * never looks like nothing happening.
 */
const STALL_MS = 9000

export function SourceSwitcher({
  control,
  loaded,
  className,
}: {
  control: StreamSourceControl
  /** Whether the frame has painted for the CURRENT src. */
  loaded: boolean
  className?: string
}) {
  const { source, sources, select, next, advance } = control
  const [autoHopped, setAutoHopped] = React.useState(false)
  // WHICH provider went quiet, not a boolean: comparing it to the current one
  // both derives `stalled` and clears it on a switch, with no second effect
  // resetting a flag — which is the version that raced.
  const [stalledId, setStalledId] = React.useState<string | null>(null)
  const hopped = React.useRef(false)
  const currentId = source?.id ?? null

  React.useEffect(() => {
    if (loaded) return
    // Restarts on a switch, so a new provider gets the full window rather than
    // inheriting the last one's expired clock.
    const timer = setTimeout(() => {
      setStalledId(currentId)
      // The one automatic hop. The guard is a ref because it has to be read and
      // written in the same tick as the call it protects — a state read here
      // would still hold the previous value and hop twice.
      if (hopped.current || !next) return
      hopped.current = true
      setAutoHopped(true)
      advance()
    }, STALL_MS)
    return () => clearTimeout(timer)
  }, [advance, currentId, loaded, next])

  const stalled = !loaded && stalledId !== null && stalledId === currentId

  // Nothing to offer at all — a deployment with one server configured.
  if (!HAS_FALLBACK_SOURCE) return null

  const showWarning = stalled && !loaded

  // Not supporting. Silent while the stream plays — the player is unchanged for
  // them and a permanent advert over a working video would be obnoxious. The
  // moment it stalls is the one moment the offer is genuinely useful, and it is
  // the most honest place on the site to make it: this is the problem, and that
  // is what fixes it.
  if (!control.canSwitch) {
    if (!showWarning) return null
    return (
      <div
        className={cn(
          'pointer-events-auto flex flex-wrap items-center justify-center gap-2 text-xs',
          className
        )}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 font-medium text-amber-300 backdrop-blur-sm">
          <AlertTriangle className="size-3.5 shrink-0" />
          This server is not responding
        </span>
        <Link
          href="/support"
          onClick={() => trackSupportCtaClicked({ surface: 'player_stall' })}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-black transition-colors hover:bg-white/90"
        >
          <Server className="size-3.5 shrink-0" />
          Supporters get backup servers
        </Link>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-wrap items-center justify-center gap-2 text-xs',
        className
      )}
    >
      {showWarning ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 font-medium text-amber-300 backdrop-blur-sm">
          <AlertTriangle className="size-3.5 shrink-0" />
          {autoHopped
            ? 'That server did not respond — trying another'
            : 'This server is not responding'}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-white/70 backdrop-blur-sm">
          <Server className="size-3.5 shrink-0" />
          Not playing? Switch server
        </span>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {sources.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === source.id}
            onClick={() => select(entry.id)}
            className={cn(
              'focus-visible:ring-primary rounded-full px-3 py-1.5 font-medium backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
              entry.id === source.id
                ? 'bg-white text-black'
                : 'bg-black/50 text-white/80 hover:bg-black/70 hover:text-white'
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  )
}
