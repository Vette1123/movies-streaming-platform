'use client'

import React from 'react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { isBackPending, restoredRail } from '@/lib/back-restore'
import { onIdleAfterLoad } from '@/lib/idle'
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
  // A rail you scrolled returns as the real List at once: the static twin only
  // has its first posters, so Back would land on empty boxes.
  const [active, setActive] = React.useState(() => restoredRail(title) > 0)
  const [rebuilt] = React.useState(isBackPending)

  React.useEffect(() => {
    if (active) return
    const el = ref.current
    if (!el) return

    // Never before the page has loaded, even for the rail on screen. Its static
    // twin looks identical and its links work, and building twenty Cards is the
    // largest thing React does on this page: all six rails on the first load
    // was 2.1s of main thread on a throttled phone, which is the whole of TBT.
    let io: IntersectionObserver | undefined
    const cancel = onIdleAfterLoad(() => {
      // No IntersectionObserver (very old browser) → hydrate anyway so the rail
      // is never left non-interactive.
      if (typeof IntersectionObserver === 'undefined') {
        setActive(true)
        return
      }
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setActive(true)
            io?.disconnect()
          }
        },
        { rootMargin: ROOT_MARGIN }
      )
      io.observe(el)
    }, 4000)
    return () => {
      cancel()
      io?.disconnect()
    }
  }, [active])

  // One stable wrapper element across the swap keeps the observer target and the
  // layout box constant (the ref never detaches, no CLS at the swap point).
  return (
    <div ref={ref}>
      {active ? (
        // No entrance: this can land on a rail already on screen, which played
        // it as the static twin, and would blink.
        <List
          title={title}
          items={items}
          itemType={itemType}
          entrance={false}
        />
      ) : (
        <StaticRail
          title={title}
          items={items}
          itemType={itemType}
          rebuilt={rebuilt}
        />
      )}
    </div>
  )
}
