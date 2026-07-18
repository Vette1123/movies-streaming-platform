'use client'

import React, { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
  CAROUSEL_ARROW_ICON_VARIANTS,
  CAROUSEL_ARROW_VARIANTS,
  CAROUSEL_NAVIGATION_VARIANTS,
  CAROUSEL_POSITION_INDICATOR_VARIANTS,
  CAROUSEL_POSITION_TEXT_VARIANTS,
  CAROUSEL_SINGLE_SLIDE_VARIANTS,
} from '@/lib/motion-variants'
import { useCarousel } from '@/hooks/use-carousel'

// How many neighbours to keep mounted on each side. A mounted neighbour has its
// image already decoded, so when it becomes active there is no network round-trip
// and no blur-in — the flash of the previous/blank slide disappears entirely.
const WINDOW = 1

const DRAG_CONSTRAINTS = { left: 0, right: 0 }

// Lets any slide freeze the carousel's autoplay while it's showing something
// that shouldn't be interrupted (a hover trailer preview, an open trailer
// dialog). Keyed by slide id and stored in a Set, so calls are idempotent and
// can never leave the pause "stuck on" the way a +1/-1 counter can.
export const CarouselPauseContext = React.createContext<{
  setSlidePaused: (id: string | number, paused: boolean) => void
}>({ setSlidePaused: () => {} })

interface CarouselProps {
  children: React.ReactNode
  autoPlay?: boolean
  autoPlayInterval?: number
  /** min-height / sizing for the stage; slides are absolute layers inside it. */
  stageClassName?: string
}

// Signed shortest distance from `current` to `i` on a ring of `count` slides,
// so slide 0 counts as the right-neighbour of the last slide (and vice versa).
function wrappedOffset(i: number, current: number, count: number) {
  let d = i - current
  if (d > count / 2) d -= count
  if (d < -count / 2) d += count
  return d
}

export function Carousel({
  children,
  autoPlay = true,
  autoPlayInterval = 5000,
  stageClassName = '',
}: CarouselProps) {
  const childrenArray = React.Children.toArray(children)
  const childrenCount = childrenArray.length
  const reduce = useReducedMotion()

  // External pause registry: the set of slide ids currently requesting a pause.
  const pausedIdsRef = React.useRef<Set<string | number>>(new Set())
  const [externalPaused, setExternalPaused] = React.useState(false)
  const setSlidePaused = React.useCallback(
    (id: string | number, paused: boolean) => {
      const set = pausedIdsRef.current
      if (paused) set.add(id)
      else set.delete(id)
      setExternalPaused(set.size > 0)
    },
    []
  )
  const pauseControls = React.useMemo(
    () => ({ setSlidePaused }),
    [setSlidePaused]
  )

  const {
    currentIndex,
    isMounted,
    isPaused,
    hasMultipleSlides,
    showAllDots,
    handleDragStart,
    handleDragEnd,
    handleHoverStart,
    handleHoverEnd,
    handleButtonClick,
    handleDotClick,
  } = useCarousel({
    childrenCount,
    autoPlay,
    autoPlayInterval,
    externalPaused,
  })

  // Keyboard control when the carousel (or anything inside it) has focus.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      handleButtonClick(-1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      handleButtonClick(1)
    }
  }

  const showProgress = autoPlay && hasMultipleSlides && !reduce

  // The active dot stretches into a pill that fills over the autoplay interval
  // (keyed by index so it restarts each slide, frozen while paused). Inactive
  // dots stay plain. This carries the autoplay progress without a full-width
  // edge line. Transform-only fill = GPU-cheap.
  const renderDot = (index: number, ariaLabel: string) => {
    if (index === currentIndex) {
      return (
        <button
          key={index}
          onClick={() => handleDotClick(index)}
          aria-label={ariaLabel}
          aria-current="true"
          className="relative h-2.5 w-7 cursor-pointer overflow-hidden rounded-full bg-white/25 ring-1 ring-white/40 sm:h-3 sm:w-8"
        >
          {showProgress ? (
            <span
              key={currentIndex}
              className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-white"
              style={{
                animation: `hero-progress ${autoPlayInterval}ms linear forwards`,
                animationPlayState: isPaused ? 'paused' : 'running',
              }}
            />
          ) : (
            <span className="absolute inset-0 rounded-full bg-white" />
          )}
        </button>
      )
    }
    return (
      <button
        key={index}
        onClick={() => handleDotClick(index)}
        aria-label={ariaLabel}
        className="size-2.5 cursor-pointer rounded-full bg-white/40 transition-all duration-300 hover:scale-110 hover:bg-white/70 sm:size-3"
      />
    )
  }

  // Compositor-only transition: opacity crossfade + a small transform slide.
  const layerTransition = useMemo(() => {
    if (reduce) return { duration: 0 }
    return {
      opacity: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const },
      x: { type: 'spring' as const, stiffness: 220, damping: 32, mass: 0.9 },
      scale: { duration: 0.8, ease: [0.4, 0, 0.2, 1] as const },
    }
  }, [reduce])

  if (childrenCount === 0) {
    return null
  }

  if (childrenCount === 1) {
    return (
      <motion.div
        className={`relative overflow-hidden ${stageClassName}`}
        {...CAROUSEL_SINGLE_SLIDE_VARIANTS}
      >
        {childrenArray[0]}
      </motion.div>
    )
  }

  return (
    <CarouselPauseContext.Provider value={pauseControls}>
    <div
      className={`group relative overflow-hidden ${stageClassName}`}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured titles"
    >
      {/* Static dark base — guarantees no white flash even on a far dot-jump
          whose target image is outside the mounted window. */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black" />

      {/* Screen-reader announcement of the current position. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Slide ${currentIndex + 1} of ${childrenCount}`}
      </div>

      {/* Stacked slide layers. Every layer inside the window stays mounted, so
          the next slide's artwork is already decoded before it fades in. */}
      {childrenArray.map((child, i) => {
        const offset = wrappedOffset(i, currentIndex, childrenCount)
        if (Math.abs(offset) > WINDOW) return null
        const active = offset === 0
        return (
          <motion.div
            key={i}
            className={`absolute inset-0 will-change-transform ${
              active ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            style={{
              zIndex: active ? 20 : 10,
              pointerEvents: active ? 'auto' : 'none',
              touchAction: 'pan-y pinch-zoom',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              backfaceVisibility: 'hidden',
            }}
            initial={false}
            animate={{
              opacity: active ? 1 : 0,
              // Gentle parallax: the incoming slide drifts in from ~6%, the
              // outgoing one drifts out the other way while it fades.
              x: `${offset * 6}%`,
              scale: active ? 1 : 1.04,
            }}
            transition={layerTransition}
            aria-hidden={!active}
            drag={active ? 'x' : false}
            dragConstraints={DRAG_CONSTRAINTS}
            dragElastic={0.08}
            dragMomentum={false}
            whileDrag={{ scale: 0.99 }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {child}
          </motion.div>
        )
      })}

      {/* Enhanced Navigation Dots with smooth animations */}
      {hasMultipleSlides && (
        <motion.div
          className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 px-2 sm:bottom-6 sm:px-4"
          initial={CAROUSEL_NAVIGATION_VARIANTS.initial}
          animate={CAROUSEL_NAVIGATION_VARIANTS.animate(isMounted)}
          transition={CAROUSEL_NAVIGATION_VARIANTS.transition}
        >
          {/* For small number of slides - show all dots */}
          {showAllDots && (
            <div className="flex max-w-[90vw] flex-wrap items-center justify-center gap-1.5 sm:max-w-none sm:gap-2">
              {childrenArray.map((_, index) =>
                renderDot(index, `Go to slide ${index + 1}`)
              )}
            </div>
          )}

          {/* For large number of slides - show pagination with truncation */}
          {!showAllDots && (
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {/* First page */}
              {renderDot(0, 'Go to first slide')}

              {/* Show dots around current position */}
              {currentIndex > 3 && (
                <span className="px-1 text-xs text-white/60">...</span>
              )}

              {/* Show 5 dots around current position */}
              {Array.from({ length: Math.min(5, childrenCount) }, (_, i) => {
                const startIndex = Math.max(
                  1,
                  Math.min(currentIndex - 2, childrenCount - 6)
                )
                const index = startIndex + i

                if (index >= childrenCount - 1 || index <= 0) return null

                return renderDot(index, `Go to slide ${index + 1}`)
              })}

              {/* Show ellipsis if there are more slides */}
              {currentIndex < childrenCount - 4 && (
                <span className="px-1 text-xs text-white/60">...</span>
              )}

              {/* Last page */}
              {renderDot(childrenCount - 1, 'Go to last slide')}
            </div>
          )}

          {/* Current position indicator with enhanced animation */}
          <motion.div
            className="my-2 text-center"
            {...CAROUSEL_POSITION_INDICATOR_VARIANTS}
          >
            <motion.span
              className="rounded-full bg-black/50 px-2 py-1 text-xs text-white/90 backdrop-blur-sm sm:text-sm"
              key={currentIndex}
              {...CAROUSEL_POSITION_TEXT_VARIANTS}
            >
              {currentIndex + 1} / {childrenCount}
            </motion.span>
          </motion.div>
        </motion.div>
      )}

      {/* Enhanced Navigation arrows with smooth animations */}
      {hasMultipleSlides && (
        <>
          {/* Left Arrow */}
          <motion.button
            onClick={() => handleButtonClick(-1)}
            className="absolute top-1/2 left-3 z-30 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white opacity-0 shadow-lg backdrop-blur-md transition-all duration-300 group-hover:opacity-100 hover:scale-105 hover:bg-white/20 focus:opacity-100 focus:ring-2 focus:ring-white/30 focus:outline-none sm:left-6 sm:size-12 lg:flex lg:opacity-0"
            aria-label="Previous slide"
            initial={CAROUSEL_ARROW_VARIANTS.initial('left')}
            animate={CAROUSEL_ARROW_VARIANTS.animate}
            whileHover={CAROUSEL_ARROW_VARIANTS.hover}
            whileTap={CAROUSEL_ARROW_VARIANTS.tap}
            transition={CAROUSEL_ARROW_VARIANTS.transition}
          >
            <motion.div
              whileHover={CAROUSEL_ARROW_ICON_VARIANTS.hover('left')}
              transition={CAROUSEL_ARROW_ICON_VARIANTS.transition}
            >
              <ChevronLeft className="size-5 sm:size-6" strokeWidth={2.5} />
            </motion.div>
          </motion.button>

          {/* Right Arrow */}
          <motion.button
            onClick={() => handleButtonClick(1)}
            className="absolute top-1/2 right-3 z-30 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white opacity-0 shadow-lg backdrop-blur-md transition-all duration-300 group-hover:opacity-100 hover:scale-105 hover:bg-white/20 focus:opacity-100 focus:ring-2 focus:ring-white/30 focus:outline-none sm:right-6 sm:size-12 lg:flex lg:opacity-0"
            aria-label="Next slide"
            initial={CAROUSEL_ARROW_VARIANTS.initial('right')}
            animate={CAROUSEL_ARROW_VARIANTS.animate}
            whileHover={CAROUSEL_ARROW_VARIANTS.hover}
            whileTap={CAROUSEL_ARROW_VARIANTS.tap}
            transition={CAROUSEL_ARROW_VARIANTS.transition}
          >
            <motion.div
              whileHover={CAROUSEL_ARROW_ICON_VARIANTS.hover('right')}
              transition={CAROUSEL_ARROW_ICON_VARIANTS.transition}
            >
              <ChevronRight className="size-5 sm:size-6" strokeWidth={2.5} />
            </motion.div>
          </motion.button>
        </>
      )}
    </div>
    </CarouselPauseContext.Provider>
  )
}
