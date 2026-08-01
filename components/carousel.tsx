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
  // Each dot is a 24px-min hit target (WCAG 2.2 target-size) with the small
  // visual mark centered inside — the dots look identical, they're just properly
  // tappable on touch instead of a 10px pinpoint.
  const renderDot = (index: number, ariaLabel: string) => {
    const isActive = index === currentIndex
    return (
      <button
        key={index}
        onClick={() => handleDotClick(index)}
        aria-label={ariaLabel}
        aria-current={isActive ? 'true' : undefined}
        className="group/dot grid h-6 min-w-6 cursor-pointer place-items-center"
      >
        {isActive ? (
          <span className="relative flex h-2.5 w-7 overflow-hidden rounded-full bg-white/25 ring-1 ring-white/40 sm:h-3 sm:w-8">
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
          </span>
        ) : (
          <span className="size-2.5 rounded-full bg-white/40 transition-all duration-300 group-hover/dot:scale-110 group-hover/dot:bg-white/70 sm:size-3" />
        )}
      </button>
    )
  }

  // Compositor-only, transform-only: the slides just move. No opacity or scale
  // to animate now that they travel a full width apart instead of crossfading —
  // which is what stops two slides ever being readable at the same time.
  // Slightly stiffer than the old parallax drift so a swipe lands promptly
  // rather than gliding for most of a second under the finger.
  const layerTransition = useMemo(() => {
    if (reduce) return { duration: 0 }
    return {
      x: { type: 'spring' as const, stiffness: 260, damping: 34, mass: 0.9 },
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
        {React.isValidElement(childrenArray[0])
          ? React.cloneElement(
              childrenArray[0] as React.ReactElement<{ active?: boolean }>,
              { active: true }
            )
          : childrenArray[0]}
      </motion.div>
    )
  }

  return (
    <CarouselPauseContext.Provider value={pauseControls}>
      <div
        data-carousel-stage
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

        {/* ONE draggable track holding the whole window, not a stack of layers.
          Everything inside moves together, so a swipe drags the neighbouring
          slide into view under the finger instead of sliding the active slide
          over an invisible one.

          This replaced an opacity crossfade of absolutely-stacked layers, which
          had two failure modes visible on a phone: mid-transition BOTH slides
          painted their full text stack (title, chips, overview, buttons) at
          partial opacity, 6% apart — two titles legible at once, which read as
          a rendering bug rather than a transition; and `drag` lived on the same
          element as `animate={{ x }}`, so framer's drag transform and the
          offset animation fought over one transform and could leave a slide
          parked at the wrong offset or opacity.

          Drag stays on the track and offsets stay on the slides, so nothing
          shares a transform. dragElastic 1 against zero-width constraints means
          the track tracks the finger 1:1 and springs home on release; when the
          release does paginate, the offsets shift by 100% at the same moment
          the track springs back to 0, and the two compose into one continuous
          motion. */}
        <motion.div
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          style={{
            touchAction: 'pan-y pinch-zoom',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          drag="x"
          dragConstraints={DRAG_CONSTRAINTS}
          dragElastic={1}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Windowed slides, laid out side by side. Off-stage slides sit a full
            width away and are clipped by the container's overflow-hidden — no
            opacity fade, so two slides can never be readable at once. Staying
            mounted keeps their artwork decoded before they scroll in. */}
          {childrenArray.map((child, i) => {
            const offset = wrappedOffset(i, currentIndex, childrenCount)
            if (Math.abs(offset) > WINDOW) return null
            const active = offset === 0
            return (
              <motion.div
                key={i}
                className="absolute inset-0 will-change-transform"
                style={{
                  pointerEvents: active ? 'auto' : 'none',
                  backfaceVisibility: 'hidden',
                }}
                initial={false}
                animate={{ x: `${offset * 100}%` }}
                transition={layerTransition}
                aria-hidden={!active}
                // Pair with aria-hidden: also pull the off-screen slide's links out
                // of the focus order + a11y tree (aria-hidden alone still leaves
                // focusable descendants → axe "aria-hidden-focus"). undefined (not
                // false) so the attribute is simply absent on the active slide.
                inert={!active || undefined}
              >
                {/* Tell the slide whether it's the one on screen, so touch devices
                  can autoplay the active slide's trailer preview (no hover). */}
                {React.isValidElement(child)
                  ? React.cloneElement(
                      child as React.ReactElement<{ active?: boolean }>,
                      { active }
                    )
                  : child}
              </motion.div>
            )
          })}
        </motion.div>

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
