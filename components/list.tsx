'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clapperboard } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import {
  ACCENT_BAR_VARIANT,
  CHANGE_COLOR_VARIANT,
  HIDDEN_TEXT_ARROW_VARIANT,
  HIDDEN_TEXT_VARIANT,
} from '@/lib/motion-variants'
import { cn, itemRedirect } from '@/lib/utils'
import { Card } from '@/components/card'
import { Icons } from '@/components/icons'

interface ListProps {
  title: string
  items: MediaType[]
  itemType?: ItemType
}

// Fraction of the visible rail width one arrow-press scrolls. ~90% keeps a
// sliver of the previous card on screen as an anchor (Netflix-style paging).
const PAGE_FRACTION = 0.9
// Past this many pixels of pointer travel a press counts as a drag, not a
// click — so a drag-to-scroll never accidentally opens the card underneath.
const DRAG_THRESHOLD = 8

/**
 * Horizontal poster rail. Replaces the old Splide carousel: the track is now a
 * native overflow-x scroll container with CSS scroll-snap, so scrolling runs on
 * the compositor (GPU) with zero per-frame JS — touch swipe and trackpad work
 * for free and stay buttery on mobile. Framer only powers the chrome (heading
 * hover, arrow reveal), never the scroll itself. Desktop keeps click-drag and
 * hover-reveal arrows for parity with the previous UX.
 */
export const List = ({ title, items, itemType = 'movie' }: ListProps) => {
  const railRef = React.useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = React.useState(false)
  const [canRight, setCanRight] = React.useState(false)

  // Pointer drag-to-scroll (mouse only — touch already scrolls natively). Kept
  // in a ref so the listeners never need to re-bind and don't trigger renders.
  const drag = React.useRef({ active: false, moved: false, startX: 0, startScroll: 0 })

  const syncArrows = React.useCallback(() => {
    const el = railRef.current
    if (!el) return
    // 1px slack absorbs sub-pixel rounding at the extremes.
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }, [])

  React.useEffect(() => {
    syncArrows()
    const el = railRef.current
    if (!el) return
    const onResize = () => syncArrows()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [syncArrows, items])

  const scrollByPage = React.useCallback((direction: 1 | -1) => {
    const el = railRef.current
    if (!el) return
    el.scrollBy({
      left: direction * el.clientWidth * PAGE_FRACTION,
      behavior: 'smooth',
    })
  }, [])

  const onPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const el = railRef.current
    if (!el) return
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startScroll: el.scrollLeft,
    }
  }, [])

  const onPointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state.active) return
    const el = railRef.current
    if (!el) return
    const delta = e.clientX - state.startX
    if (!state.moved && Math.abs(delta) > DRAG_THRESHOLD) {
      state.moved = true
      el.setPointerCapture(e.pointerId)
    }
    if (state.moved) el.scrollLeft = state.startScroll - delta
  }, [])

  const endDrag = React.useCallback(() => {
    drag.current.active = false
  }, [])

  // If the press turned into a drag, swallow the click so the card link under
  // the cursor doesn't fire. Runs in the capture phase, before the link's own
  // handler. `moved` is reset here so the next genuine click passes through.
  const onClickCapture = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }, [])

  return (
    <nav className="py-6 sm:py-8 lg:py-10">
      <motion.div
        initial="rest"
        whileHover="hover"
        animate="rest"
        className="w-fit"
      >
        <Link
          href={itemRedirect(itemType)}
          // Homepage stacks many carousels; each heading would viewport-prefetch a
          // section route. Every prefetch is an extra Worker RSC hit — skip it.
          prefetch={false}
          className="mb-4 flex w-fit items-center gap-2"
        >
          <motion.h2
            className="flex items-center gap-2.5 text-2xl font-bold tracking-tight transition"
            variants={CHANGE_COLOR_VARIANT}
          >
            <motion.span
              aria-hidden
              variants={ACCENT_BAR_VARIANT}
              className="h-5 w-[3px] origin-center rounded-full bg-gradient-to-b from-cyan-300 to-cyan-500 shadow-[0_0_8px_rgba(103,232,249,0.5)]"
            />
            {title}
          </motion.h2>
          <motion.div
            className="mt-1 text-base text-cyan-200"
            variants={HIDDEN_TEXT_VARIANT}
          >
            <span className="font-sans text-sm font-medium">Explore All</span>
          </motion.div>
          <motion.span
            variants={HIDDEN_TEXT_ARROW_VARIANT}
            className="mt-1 text-base text-cyan-200"
          >
            <Icons.arrowRight className="ml-1 inline-block h-4 w-4" />
          </motion.span>
        </Link>
      </motion.div>

      {items.length === 0 && (
        <div
          role="status"
          className="text-muted-foreground border-border/60 flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm"
        >
          <Clapperboard className="size-4 shrink-0 opacity-70" />
          Nothing to show here yet — check back soon.
        </div>
      )}

      {items.length > 0 && (
        <div className="group/rail relative">
          {/* Scroll track: native, GPU-driven, snap-aligned. `-my-4 py-4` gives
              the hover-scaled posters vertical breathing room without clipping
              (overflow-x forces overflow-y to clip), while keeping the visual
              row flush with siblings. Scrollbar hidden via .no-scrollbar. */}
          <div
            ref={railRef}
            onScroll={syncArrows}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            onClickCapture={onClickCapture}
            className="no-scrollbar -my-4 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth py-4"
          >
            {items.map((item) => (
              <div key={item.id} className="shrink-0 snap-start">
                <Card item={item} itemType={itemType} />
              </div>
            ))}
          </div>

          {/* Hover-revealed glass arrows (lg+ only; touch uses swipe). Each fades
              out at its end of the track. Mirrors the hero carousel's chrome. */}
          <RailArrow
            direction="left"
            visible={canLeft}
            onClick={() => scrollByPage(-1)}
          />
          <RailArrow
            direction="right"
            visible={canRight}
            onClick={() => scrollByPage(1)}
          />
        </div>
      )}
    </nav>
  )
}

interface RailArrowProps {
  direction: 'left' | 'right'
  visible: boolean
  onClick: () => void
}

const RailArrow = ({ direction, visible, onClick }: RailArrowProps) => {
  const isLeft = direction === 'left'
  const Icon = isLeft ? ChevronLeft : ChevronRight
  return (
    // Pure-CSS chrome: Tailwind v4 drives `translate`/`scale` as independent CSS
    // properties, so the hover scale never disturbs the -translate-y-1/2
    // centering (and there's no per-arrow motion node to mount).
    <button
      type="button"
      aria-label={isLeft ? 'Scroll left' : 'Scroll right'}
      onClick={onClick}
      tabIndex={visible ? 0 : -1}
      className={cn(
        'absolute top-1/2 z-20 hidden size-12 -translate-y-1/2 scale-100 place-items-center rounded-full border border-white/15 bg-[rgba(10,12,20,0.62)] text-white shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md backdrop-saturate-150 lg:grid',
        'opacity-0 transition-[opacity,scale,background,border-color] duration-300 ease-out',
        'hover:scale-[1.08] hover:border-cyan-300/55 hover:bg-[rgba(20,24,36,0.82)] active:scale-95',
        'focus-visible:border-cyan-300/70 focus-visible:opacity-100 focus-visible:outline-none',
        'group-hover/rail:opacity-100 group-focus-within/rail:opacity-100',
        isLeft ? 'left-2' : 'right-2',
        !visible && 'pointer-events-none !opacity-0'
      )}
    >
      <Icon className="size-[1.1rem] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
    </button>
  )
}
