'use client'

import React from 'react'
import Link from 'next/link'

import { usePrefetchIntent } from '@/hooks/use-prefetch-intent'
import { preloadHeroImage } from '@/components/header/hero-image'
import { LinkPendingBar } from '@/components/media/link-pending-bar'

// Every anchor prop, not a hand-picked five. The old shape listed href /
// className / children / onClick / aria-label and silently dropped the rest,
// which is a quiet trap for anything that renders this `asChild`: Radix's
// HoverCardTrigger clones its child and hands it `data-state`, a ref and
// onPointerEnter/onPointerLeave/onFocus/onBlur. None of them reached the <a>, so
// the card's details popover had no trigger and no anchor — it never opened, on
// any device, and nothing errored. `ref` matters as much as the handlers: Radix
// Popper positions against the trigger's DOM node.
type MediaLinkProps = React.ComponentPropsWithRef<'a'> & {
  href: string
  /**
   * The title's artwork, when the caller has it: the detail hero's picture
   * starts downloading on the press instead of after the page arrives.
   */
  art?: { backdrop_path?: string | null; poster_path?: string | null } | null
}

/** Run the caller's handler and then ours — neither wins, both fire. */
function chain<E>(theirs?: (event: E) => void, ours?: (event: E) => void) {
  return (event: E) => {
    theirs?.(event)
    ours?.(event)
  }
}

/**
 * The one link used for anything that points at a media detail route.
 *
 * Detail routes are the ones that must NOT viewport-prefetch: a homepage mounts
 * 100+ posters, and one RSC request each trips the Cloudflare rate limit on
 * detail paths (100 req/10s) on our own page load. But `prefetch={false}` alone
 * means the route is never warmed at all in Next 16 — see
 * hooks/use-prefetch-intent.ts — so the pairing of that prop with the intent
 * handlers has to travel together or a caller gets one without the other. It had
 * already been hand-rolled three different ways across Card, WatchedItemCard,
 * StaticRail and the hero, each with its own comment and one (the hero's) with
 * no touch handler at all.
 *
 * Being a client component is also what lets StaticRail — which is deliberately
 * server-rendered, with no client machinery of its own — warm its posters
 * without hydrating the whole rail.
 */
export function MediaLink({
  href,
  art,
  children,
  ref,
  ...rest
}: MediaLinkProps) {
  const intent = usePrefetchIntent(href)

  // The hero's picture is the second half of what a detail page waits on, and
  // it used to be requested only once the page had rendered: payload, THEN
  // image. Started on the press it rides alongside the payload. Not on hover or
  // touchstart like the route — a backdrop is 65-200 KB, and a thumb scrolling
  // a rail brushes every poster in it. mousedown is a committed press on a
  // desktop (~100ms before the click); click covers touch and keyboard. React
  // dedupes the second call.
  const warmArt = React.useCallback(() => preloadHeroImage(art), [art])

  // Three of the four warming handlers can collide with a caller's own (Radix
  // passes onFocus; the hero passes onMouseEnter), so they are chained rather
  // than spread — a plain `{...intent}` after `{...rest}` would drop the
  // caller's, and before it would drop the prefetch. Memoised on the same terms
  // as the hook's own object: a Link should not get three fresh handler props
  // every render.
  const handlers = React.useMemo(
    () => ({
      onMouseEnter: chain(rest.onMouseEnter, intent.onMouseEnter),
      onFocus: chain(rest.onFocus, intent.onFocus),
      onTouchStart: chain(rest.onTouchStart, intent.onTouchStart),
      onMouseDown: chain(rest.onMouseDown, warmArt),
      onClick: chain(rest.onClick, warmArt),
    }),
    [
      rest.onMouseEnter,
      rest.onFocus,
      rest.onTouchStart,
      rest.onMouseDown,
      rest.onClick,
      intent,
      warmArt,
    ]
  )

  return (
    <Link ref={ref} href={href} prefetch={false} {...rest} {...handlers}>
      {children}
      <LinkPendingBar />
    </Link>
  )
}
