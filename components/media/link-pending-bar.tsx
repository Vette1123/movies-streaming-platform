'use client'

import { useLinkStatus } from 'next/link'
import { createPortal } from 'react-dom'

/**
 * A hairline across the top of the viewport while the detail page a link
 * points at is on its way.
 *
 * The detail routes used to answer a click with `loading.tsx`: a grey slab the
 * size of the viewport, shaped like nothing on the page that replaced it, for
 * however long the payload took (0.9s measured on a cold click from the
 * homepage). Without it the page you clicked from stays put until the next one
 * is ready, which on a prefetched route is no time at all. On a slow link that
 * would read as a dead click, so this says otherwise, and only after 150ms (see
 * --animate-nav-pending), so a fast navigation shows nothing at all.
 *
 * Must render inside the <Link> (useLinkStatus reads the nearest one), and is
 * portalled out of it because a card under a hover transform would otherwise
 * become the containing block of a `fixed` element.
 */
export function LinkPendingBar() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return createPortal(
    <span
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5 origin-left animate-nav-pending bg-primary opacity-0"
    />,
    document.body
  )
}
