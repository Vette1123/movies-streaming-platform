'use client'

import React from 'react'
import {
  animate,
  motion,
  PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
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

// Damping is just past critical for this stiffness, so it settles (~300ms) with
// no overshoot — a carousel that wobbles past its stop looks broken, not springy.
const SLIDE_SPRING = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 36,
  mass: 1,
}

// The cinematic part of the old transition, kept. The original crossfaded
// opacity AND drifted x AND scaled; only the opacity crossfade caused the
// ghosting (two full text stacks legible at once, 6% apart), so the zoom comes
// back and the crossfade does not. An off-frame slide sits fractionally larger
// and settles to 1:1 as it takes the frame, which reads as depth — and it can
// never double-expose anything, because the slides are still a full width apart
// and clipped by the stage.
// Down, not up. Scaling an off-frame slide UP grows it about its centre, so at
// rest its inner edge lands at 95.25% and ~20px of the NEXT slide is visible at
// the edge of the stage. Scaling down moves that edge to 101.5% — off-frame by
// construction, at any stage width — and the slide zooms in as it takes the
// frame, which is the depth cue the old crossfade was really providing.
const SLIDE_REST_SCALE = 1
const SLIDE_OFF_SCALE = 0.98
// How far the whole stage recedes at a full-width drag.
const DRAG_SCALE_DEPTH = 0.02

// Dark gutter between slides, in px. Every slide carries its own left-to-right
// readability scrim (from-black/90 ... to-black/20), so abutting them puts the
// outgoing slide's LIGHTEST edge hard against the incoming slide's DARKEST one —
// a luminance step that reads as an ugly border drawn down the middle of the
// swipe. Separating them lands that step on the stage's own black base instead,
// where it's a deliberate gap between two pieces of art rather than a seam.
const SLIDE_GAP = 24

// useLayoutEffect on the server is a no-op that React warns about, and the
// compensation below only has meaning once there's a DOM to measure.
const useIsoLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

// Which way a step went on the ring, clamped to a single slide. A dot jump of
// seven still animates as one slide-width glide: the slides in between are
// outside the mounted window, so a literal seven-width translate would just be
// a long drag through empty space.
function stepDirection(from: number, to: number, count: number) {
  if (from === to) return 0
  const forward = (to - from + count) % count
  return forward * 2 <= count ? 1 : -1
}

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

  // ONE animated element. Slides are placed instantly at whole multiples of the
  // stage width and never animate; the track carries all the motion, and every
  // route to a new slide — drag, arrow, dot, keyboard, autoplay — lands in the
  // same place below. Cheaper too: one transform to composite instead of three.
  //
  // Two earlier versions failed here, both for the same reason — something else
  // was also animating x:
  //   1. Track AND slides both sprang. They could not be made to agree, because
  //      framer seeds the drag snapback with the flick's velocity while a fresh
  //      `animate` starts from rest, so on release the incoming slide visibly
  //      slid BACKWARDS ~30px before coming forward (172 -> 203 -> 56 -> 3 -> 0).
  //   2. Only the track sprang, but `dragConstraints` was still set — so framer
  //      started its own snapback at pointerup and had already dragged x most of
  //      the way home by the time the layout effect read it, landing the track a
  //      full width off (416 where 172 was correct).
  // Hence NO dragConstraints: with nothing to snap back to, x simply stays where
  // the finger left it and this component owns every pixel of the return.
  const x = useMotionValue(0)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const prevIndexRef = React.useRef(currentIndex)

  // Stage width, kept in a ref rather than measured where it's needed. The drag
  // scale below reads it every frame, and offsetWidth forces a synchronous
  // layout — doing that inside a motion transform would reflow the page on each
  // tick of every swipe.
  const widthRef = React.useRef(0)
  useIsoLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      widthRef.current = el.offsetWidth
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The whole stage eases back a touch while you drag it and returns as it
  // settles — the frame reads as a physical card being pushed rather than a
  // texture sliding. Derived from x, so it's the same gesture-linked motion
  // whether you drag, flick, or tap an arrow, and it costs nothing extra: it
  // composites into the transform the track was already applying.
  const scale = useTransform(x, (value) => {
    if (reduce) return 1
    const width = widthRef.current
    if (!width) return 1
    return 1 - Math.min(Math.abs(value) / width, 1) * DRAG_SCALE_DEPTH
  })

  // True whenever the track is off-rest: mid-drag, or springing back. Drives the
  // slide edge fades below, which must not be visible when the hero is sitting
  // still. The token guards against an interrupted settle (swipe again before
  // the last one lands) resolving late and switching the fades off mid-motion.
  const [moving, setMoving] = React.useState(false)
  const settleTokenRef = React.useRef(0)

  const settle = React.useCallback(() => {
    const token = ++settleTokenRef.current
    setMoving(true)
    if (reduce) {
      x.jump(0)
      setMoving(false)
      return undefined
    }
    const controls = animate(x, 0, SLIDE_SPRING)
    const done = () => {
      if (settleTokenRef.current === token) setMoving(false)
    }
    controls.then(done, done)
    return controls
  }, [reduce, x])

  // Where the finger let go, frozen at pointerup. The effect below cannot just
  // read x.get(): a paginating release re-renders a whole slide before React
  // commits, and x has measurably drifted by then (-240 at release, -119 by the
  // time the effect ran), which lands the compensation short.
  const releaseXRef = React.useRef<number | null>(null)

  useIsoLayoutEffect(() => {
    const prev = prevIndexRef.current
    if (prev === currentIndex) return
    prevIndexRef.current = currentIndex

    const from = releaseXRef.current ?? x.get()
    releaseXRef.current = null
    const step = stepDirection(prev, currentIndex, childrenCount)
    // The new active slide just jumped from `step * width` to 0. Push the track
    // the other way by the same amount and the frame doesn't move at all — then
    // animate that debt away, and THAT is the whole transition. Continuous by
    // construction from wherever the finger let go, at any release velocity.
    //
    // jump(), not set(): set() records the discontinuity as velocity, and the
    // spring inherited it and flew a further 120px PAST the start before turning
    // round (293 -> 414 -> 0). jump() reseats the value at rest.
    // width + gap, because that's the real distance the slides just moved.
    x.jump(from + step * (widthRef.current + SLIDE_GAP))
    const controls = settle()
    return () => controls?.stop()
  }, [currentIndex, childrenCount, settle, x])

  // A drag that doesn't cross the threshold never changes the index, so the
  // effect above won't run — this is what returns the track in that case. It has
  // to be exclusive: settling here as well when the release DOES paginate meant
  // this animation had already pulled x part-way home before the effect read it,
  // and the compensation landed short (172 wanted, 293 measured).
  const onDragEnd = React.useCallback(
    (event: PointerEvent, info: PanInfo) => {
      releaseXRef.current = x.get()
      if (handleDragEnd(event, info)) return
      releaseXRef.current = null
      settle()
    },
    [handleDragEnd, settle, x]
  )

  const onDragStart = React.useCallback(
    (event: PointerEvent, info: PanInfo) => {
      setMoving(true)
      handleDragStart(event, info)
    },
    [handleDragStart]
  )

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
        ref={stageRef}
        data-carousel-stage
        // tabIndex makes the stage keyboard-operable, but it also means a touch
        // or a click FOCUSES it — and the UA default painted a 1px amber outline
        // around the entire hero the instant you put a finger on it to swipe.
        // focus-visible keeps the ring for keyboard users and drops it for
        // pointer input, which is exactly who was seeing the border.
        className={`group relative overflow-hidden outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/70 ${stageClassName}`}
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

          Unconstrained, so it follows the finger 1:1 and stays put on release;
          the layout effect above owns the return, which is what makes drag and
          autoplay produce the identical motion. */}
        <motion.div
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          style={{
            x,
            scale,
            touchAction: 'pan-y pinch-zoom',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          drag="x"
          dragMomentum={false}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {/* Windowed slides, laid out side by side and placed INSTANTLY — plain
            divs, no animation of their own. Off-stage slides sit a full width
            away and are clipped by the container's overflow-hidden, so two
            slides can never be readable at once. Staying mounted keeps their
            artwork decoded before they scroll in. */}
          {childrenArray.map((child, i) => {
            const offset = wrappedOffset(i, currentIndex, childrenCount)
            if (Math.abs(offset) > WINDOW) return null
            const active = offset === 0
            return (
              <motion.div
                key={i}
                className="absolute inset-0"
                // x stays a plain style, NOT an animated property: the track owns
                // all horizontal motion, and anything else writing x is what
                // broke the release twice before. Only scale animates here, so
                // the two never touch the same axis.
                style={{
                  x: `calc(${offset * 100}% + ${offset * SLIDE_GAP}px)`,
                  pointerEvents: active ? 'auto' : 'none',
                  backfaceVisibility: 'hidden',
                }}
                initial={false}
                animate={{
                  scale: active ? SLIDE_REST_SCALE : SLIDE_OFF_SCALE,
                }}
                transition={reduce ? { duration: 0 } : SLIDE_SPRING}
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

                {/* Edge falloff, ONLY while the track is off-rest. The gutter
                  alone didn't fix the seam: a slide's scrim runs from-black/90
                  to-black/20, so its trailing edge is the BRIGHTEST part of the
                  frame and ends on a hard vertical line against the gap — which
                  is the border you can see mid-swipe. Dissolving both edges into
                  the black base removes the line whatever the artwork is doing.
                  Gated on `moving` so the hero is never vignetted sitting still,
                  and the fade in/out happens under cover of the motion itself. */}
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-y-0 -left-px z-[70] w-10 bg-gradient-to-r from-black via-black/60 to-transparent transition-opacity duration-200 sm:w-20 ${
                    moving ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-y-0 -right-px z-[70] w-10 bg-gradient-to-l from-black via-black/60 to-transparent transition-opacity duration-200 sm:w-20 ${
                    moving ? 'opacity-100' : 'opacity-0'
                  }`}
                />
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
