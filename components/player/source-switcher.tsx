'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronDown, Server, Sparkles } from 'lucide-react'

import { HAS_FALLBACK_SOURCE, REELY_SOURCE_ID } from '@/config/sources'
import { trackSupportCtaClicked } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { type StreamSourceControl } from '@/hooks/use-stream-source'
import {
  Popover,
  PopoverContent,
  PopoverHeading,
  PopoverRow,
  PopoverTrigger,
} from '@/components/ui/popover'

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
 * The control is always there while something is playing, because the failure
 * this cannot detect — a provider that loads a page and then plays nothing — is
 * common enough that "it loaded" is not the same as "it works".
 *
 * ONE CONTROL, NOT ONE PER SERVER. Every server used to be its own pill on the
 * bar. Three of them plus Settings is already wider than a phone, so the row
 * became a rail that scrolled — and a rail that scrolls hides something. On a
 * 412px phone the measured overflow was 77px, all of it eaten off the left
 * edge, which is where the house player sits: a supporter watching the player
 * they pay for saw a 40px sliver of magenta and three servers they were not
 * on. Before the rail it was `flex-wrap`, which was four rows of pills over the
 * picture. Both are the same mistake — sizing a control to the number of
 * providers configured.
 *
 * A trigger that names what is playing plus a list on tap is fixed-width by
 * construction: a sixth provider changes what is inside the panel and nothing
 * about the bar. It is also the control next door — Settings is a pill in this
 * same bar that opens a popover — so the two halves of the player's chrome now
 * work the same way instead of two ways.
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

/**
 * The house player's mark, and only on the gradient pill.
 *
 * Cut OUT of the gradient rather than painted on top of it: a badge carrying
 * the same three stops as the pill behind it is a lozenge you have to look
 * twice at. It is not repeated inside the list, where the row already carries
 * a different icon, a different name, a line of copy and a heading separating
 * it from the servers — a fifth signal there is decoration.
 */
function ProMark() {
  return (
    <span className="rounded-full bg-black/35 px-1.5 py-px text-[9px] leading-tight font-bold tracking-wider text-white/95">
      PRO
    </span>
  )
}

/**
 * The trigger wears what is playing.
 *
 * On the house player it takes the signature gradient, so a supporter can tell
 * at a glance which surface they are on; on an embed it is a quiet glass pill
 * that does not compete with the picture underneath. Open state is carried by
 * light, never by a ring: `ring-2` draws OUTSIDE the border box and stood the
 * pill taller than the gear beside it, cropped by the bar's own padding.
 */
function triggerClass(onHouse: boolean, open: boolean): string {
  if (onHouse) {
    return cn(
      'relative isolate bg-linear-to-r from-amber-500 via-rose-500 to-fuchsia-600 font-semibold text-white shadow-[0_1px_10px_-3px_rgba(244,63,94,0.55)] ring-1 ring-white/25 ring-inset',
      open
        ? 'shadow-[0_2px_18px_-3px_rgba(244,63,94,0.95)] ring-white/55'
        : 'hover:shadow-[0_2px_14px_-3px_rgba(244,63,94,0.8)]'
    )
  }
  return cn(
    'font-medium text-white/90 hover:bg-white/15 hover:text-white',
    open && 'bg-white/15 text-white'
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
   * Pinned to the end of the bar — the player's own settings. It lives inside
   * this bar rather than beside it because a second floating pill next to the
   * server control reads as a second player, and because two independent bars
   * cannot agree on a height.
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
  const [open, setOpen] = React.useState(false)
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

  // The house player is not "another server" — it is the product, so it leads
  // the list on its own rather than sitting in a run of Server N. Found by id
  // rather than taken from position 0: the order the tier hands us is a fact
  // about entitlement, not something this list should depend on.
  const house = sources.find((entry) => entry.id === REELY_SOURCE_ID)
  const embeds = sources.filter((entry) => entry.id !== REELY_SOURCE_ID)
  const onHouse = source.id === REELY_SOURCE_ID
  const TriggerIcon = onHouse ? Sparkles : Server

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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              // Named rather than left to the visible label alone: "Server 2"
              // on its own says nothing about what the control does, and it is
              // the whole accessible name of the only way off a dead stream.
              aria-label={`Streaming server: ${source.label}`}
              className={cn(
                'tap-target inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full px-3 whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/60 focus-visible:outline-hidden',
                triggerClass(onHouse, open)
              )}
            >
              {onHouse ? (
                // The top-edge highlight every physical control has and no flat
                // gradient does. Inside the pill, above the gradient, below the
                // label — the cheapest thing that separates a button from a
                // coloured rectangle.
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-linear-to-b from-white/30 to-transparent to-45%"
                />
              ) : null}
              <TriggerIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{source.label}</span>
              {onHouse ? <ProMark /> : null}
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-3.5 shrink-0 opacity-70 transition-transform',
                  open && 'rotate-180'
                )}
              />
            </button>
          </PopoverTrigger>

          {/* Opens downward over the picture, because the trigger sits in a bar
              pinned to the top of the frame and there is nothing above it but
              the page header. Never wider than the phone it is on. */}
          <PopoverContent
            align="center"
            side="bottom"
            sideOffset={8}
            className="z-60 w-[min(20rem,calc(100vw-2rem))] p-1.5"
          >
            <div role="group" aria-label="Streaming server">
              {house ? (
                <>
                  <PopoverRow
                    Icon={Sparkles}
                    iconClassName="text-fuchsia-400"
                    title={house.label}
                    subtitle="Subtitles, quality and resume"
                    pressed={house.id === source.id}
                    onClick={() => select(house.id)}
                  />
                  <PopoverHeading>Other servers</PopoverHeading>
                </>
              ) : null}

              {embeds.map((entry) => (
                <PopoverRow
                  key={entry.id}
                  Icon={Server}
                  title={entry.label}
                  pressed={entry.id === source.id}
                  onClick={() => select(entry.id)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

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
