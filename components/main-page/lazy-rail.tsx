'use client'

import React from 'react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { List } from '@/components/list'
import { StaticRail } from '@/components/main-page/static-rail'

interface LazyRailProps {
  title: string
  items: MediaType[]
  itemType?: ItemType
}

// Hydrate the interactive rail this far before it enters the viewport, so the
// real List (framer heading, HoverCards, drag/arrows) is ready by the time the
// user scrolls to it — the swap is never something they watch happen.
const ROOT_MARGIN = '800px 0px'

/**
 * Below-fold rail hydration island. Renders the static, no-JS <StaticRail> on
 * the server and on first client paint (so hydration matches exactly — no
 * mismatch, no content loss, cards + links stay in the SSR HTML for SEO/CLS),
 * then swaps in the full interactive <List> once the rail nears the viewport.
 *
 * This is the SSR-safe alternative to a naive lazy-mount (which would strip the
 * cards from SSR and regress SEO/CLS): the poster row is always present; only
 * List's per-card client machinery is deferred, cutting the below-fold hydration
 * work — the JS/TBT cost that a home of six client rails pays up front.
 */
export function LazyRail({ title, items, itemType = 'movie' }: LazyRailProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState(false)

  React.useEffect(() => {
    if (active) return
    const el = ref.current
    if (!el) return

    // No IntersectionObserver (very old browser) → hydrate immediately so the
    // rail is never left non-interactive.
    if (typeof IntersectionObserver === 'undefined') {
      setActive(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true)
          io.disconnect()
        }
      },
      { rootMargin: ROOT_MARGIN }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  // One stable wrapper element across the swap keeps the observer target and the
  // layout box constant (the ref never detaches, no CLS at the swap point).
  return (
    <div ref={ref}>
      {active ? (
        <List title={title} items={items} itemType={itemType} />
      ) : (
        <StaticRail title={title} items={items} itemType={itemType} />
      )}
    </div>
  )
}
