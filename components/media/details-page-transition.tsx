import React, { ViewTransition } from 'react'

/**
 * The way into a details page from a detail link: a 200ms crossfade instead
 * of a cut. MediaLink tags those navigations `to-details`; the arriving page
 * fades in as its own snapshot while the page being left fades out as the
 * document's root snapshot (timings in styles/globals.css).
 *
 * Wraps the page's outermost element on purpose. React runs an `enter` only
 * for a <ViewTransition> that comes before every DOM node the transition
 * inserts — one inside the page's own <header>, around the hero, was measured
 * to never fire. A page entering has no old box to slide from, so its size
 * does not matter here, where a boundary around <main> would have slid
 * between a scrolled homepage's offset and the top.
 *
 * Everything other than entering is "none". An episode pick, a server switch,
 * a season tab all update this tree inside transitions, and fading a picture
 * that is playing would be the opposite of the point.
 */
export function DetailsPageTransition({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ViewTransition
      default="none"
      enter={{ 'to-details': 'details-enter', default: 'none' }}
    >
      {children}
    </ViewTransition>
  )
}
