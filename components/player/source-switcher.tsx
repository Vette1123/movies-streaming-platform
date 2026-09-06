'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, Server, Sparkles } from 'lucide-react'

import { HAS_FALLBACK_SOURCE, REELY_SOURCE_ID } from '@/config/sources'
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
 *
 * ONE ROW, ALWAYS. The servers used to `flex-wrap`, which is fine at three and
 * a wall at six: a supporter on a phone got four rows of near-identical pills
 * laid over the picture, and the row height changed under them every time the
 * stall notice swapped in. A rail that scrolls has a height that does not
 * depend on how many providers are configured or how wide the phone is, so the
 * band above the video can reserve it and the picture never moves.
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

/**
 * Whether a scroller has anything to scroll to.
 *
 * Drives two things that both look wrong if guessed: the rail centres its
 * entries when they fit and left-aligns them when they do not (a centred
 * overflowing row hides its own first entry under the left edge), and the edge
 * fade only appears when there is something past the edge to fade.
 */
function useOverflows(ref: React.RefObject<HTMLElement | null>): boolean {
  const [overflows, setOverflows] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setOverflows(node.scrollWidth > node.clientWidth + 1)
    measure()
    // Fires on the element's own resize AND on content changes that resize it,
    // so a tier change that adds the house player is covered without a second
    // effect keyed on the list.
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    for (const child of node.children) observer.observe(child)
    return () => observer.disconnect()
  }, [ref])

  return overflows
}

/** The shell every state of this bar shares: one pill-shaped, glassy row. */
function Bar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/75 p-1 text-xs shadow-[0_2px_12px_-2px_rgba(0,0,0,0.7)] backdrop-blur-md',
        className
      )}
    >
      {children}
    </div>
  )
}

/** The one thing this component can actually detect, said plainly. */
function StallNotice({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="status"
      className="pointer-events-auto inline-flex max-w-full items-center gap-1.5 rounded-full bg-amber-950/90 px-3 py-1 text-[11px] font-medium text-amber-200 ring-1 ring-amber-400/30 backdrop-blur-md"
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function SourceSwitcher({
  control,
  loaded,
  trailing,
  className,
}: {
  control: StreamSourceControl
  /** Whether the frame has painted for the CURRENT src. */
  loaded: boolean
  /**
   * Pinned to the end of the bar and never scrolled away — the player's own
   * settings. It lives inside this bar rather than beside it because a second
   * floating pill next to six server pills reads as a seventh server, and
   * because two independent bars cannot agree on a height.
   */
  trailing?: React.ReactNode
  className?: string
}) {
  const { source, sources, select, next, advance } = control
  const [autoHopped, setAutoHopped] = React.useState(false)
  // WHICH provider went quiet, not a boolean: comparing it to the current one
  // both derives `stalled` and clears it on a switch, with no second effect
  // resetting a flag — which is the version that raced.
  const [stalledId, setStalledId] = React.useState<string | null>(null)
  const hopped = React.useRef(false)
  const railRef = React.useRef<HTMLDivElement>(null)
  const railOverflows = useOverflows(railRef)
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

  // Keep the playing server in view. Switching by keyboard, and the automatic
  // hop, both move the selection to an entry that can be off the visible part
  // of the rail — and an entry you cannot see cannot tell you what is playing.
  React.useEffect(() => {
    const rail = railRef.current
    // Only when there is somewhere to scroll TO. On a rail that fits, this
    // would still be a scroll call, and a scroll call on an element inside a
    // full-viewport hero is one the page can decide to answer itself.
    if (!rail || !currentId || !railOverflows) return
    rail
      .querySelector(`[data-source-id="${CSS.escape(currentId)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [currentId, railOverflows])

  const stalled = !loaded && stalledId !== null && stalledId === currentId
  const showWarning = stalled && !loaded

  // Nothing to offer at all — a deployment with one server configured. The
  // settings control, if there is one, still has to reach the screen.
  if (!HAS_FALLBACK_SOURCE) {
    if (!trailing) return null
    return (
      <div className={cn('flex justify-center', className)}>
        <Bar>{trailing}</Bar>
      </div>
    )
  }

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
          'flex flex-col items-center gap-1.5 px-4 text-xs',
          className
        )}
      >
        <StallNotice>This server is not responding</StallNotice>
        <Link
          href="/support"
          onClick={() => trackSupportCtaClicked({ surface: 'player_stall' })}
          className="tap-target pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-black transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/60 focus-visible:outline-hidden"
        >
          <Server className="size-3.5 shrink-0" aria-hidden />
          Supporters get backup servers
        </Link>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 px-4 text-xs',
        className
      )}
    >
      {showWarning ? (
        <StallNotice>
          {autoHopped
            ? 'That server did not respond. Trying another'
            : 'This server is not responding'}
        </StallNotice>
      ) : null}

      <Bar>
        {/* Says what the row is without spending a tap target on it. Hidden on
            phones, where the row itself is the whole width worth having. */}
        <span className="hidden shrink-0 items-center gap-1.5 pr-0.5 pl-2.5 font-medium text-white/70 sm:inline-flex">
          <Server className="size-3.5 shrink-0" aria-hidden />
          Servers
        </span>

        <div
          ref={railRef}
          role="group"
          aria-label="Streaming server"
          className={cn(
            'no-scrollbar flex min-w-0 snap-x snap-proximity items-center gap-1.5 overflow-x-auto motion-safe:scroll-smooth',
            railOverflows
              ? 'justify-start mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]'
              : 'justify-center'
          )}
        >
          {sources.map((entry) => {
            // The house player is not "another server" — it is the product.
            // Give it a look nothing else on this bar can be confused with:
            // signature gradient, spark, and a PRO mark. Active or not, it
            // always reads premium so supporters see what they are paying for
            // and free visitors see what they are missing.
            const isReely = entry.id === REELY_SOURCE_ID
            const isActive = entry.id === source.id
            const shared =
              'tap-target inline-flex h-7 shrink-0 snap-start items-center gap-1.5 rounded-full px-3 whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/60 focus-visible:outline-hidden'

            if (isReely) {
              return (
                <button
                  key={entry.id}
                  type="button"
                  data-source-id={entry.id}
                  aria-pressed={isActive}
                  onClick={() => select(entry.id)}
                  className={cn(
                    shared,
                    'font-semibold text-white',
                    'bg-linear-to-r from-amber-500 via-rose-500 to-fuchsia-600',
                    'shadow-[0_1px_10px_-2px_rgba(244,63,94,0.65)]',
                    'hover:shadow-[0_2px_14px_-2px_rgba(244,63,94,0.85)]',
                    !isActive && 'opacity-75 hover:opacity-100',
                    isActive && 'ring-2 ring-white/90'
                  )}
                >
                  <Sparkles className="size-3.5 shrink-0" aria-hidden />
                  {entry.label}
                  <span className="rounded-full bg-black/30 px-1.5 py-px text-[9px] leading-tight font-bold tracking-wider">
                    PRO
                  </span>
                </button>
              )
            }

            return (
              <button
                key={entry.id}
                type="button"
                data-source-id={entry.id}
                aria-pressed={isActive}
                onClick={() => select(entry.id)}
                className={cn(
                  shared,
                  'font-medium',
                  isActive
                    ? 'bg-white text-black'
                    : 'text-white/85 hover:bg-white/15 hover:text-white'
                )}
              >
                {entry.label}
              </button>
            )
          })}
        </div>

        {trailing ? (
          <>
            <span aria-hidden className="h-4 w-px shrink-0 bg-white/15" />
            {trailing}
          </>
        ) : null}
      </Bar>
    </div>
  )
}
