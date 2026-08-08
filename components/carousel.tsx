'use client'

import React from 'react'
import {
  animate,
  motion,
  PanInfo,
  useMotionValue,
  useReducedMotion,
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

// NOTHING SCALES. The swipe is a pure horizontal translate of one element, and
// that is the entire reason it is smooth.
//
// There were two scale effects here: the whole stage receded slightly while you
// dragged it, and each slide sat at 0.98 off-frame and grew to 1:1 as it took
// the frame. Both were sold as "depth", and both were measured as free — but
// they were measured while every slide was pinned to its own compositor layer,
// where a scale is just a matrix on a finished texture.
//
// That promotion had to go: scaled layers resample, and the resampling put
// coloured fringes on the artwork and the title treatment. Without it, a scale
// is no longer free — it is the opposite. A transform that changes SIZE cannot
// be composited from the existing raster, so every frame of every drag
// re-rasterised the full stage at a new scale: three slides, backdrop, scrim,
// title, chips, buttons, at 393x851 and dpr 3. A translate needs none of that;
// the compositor shifts what it already has.
//
// So the choice was depth-with-fringing-and-jank, or a clean fast swipe. The
// carousel keeps the spring, the drag-follows-your-finger feel, and the
// artwork. It does not keep two percent of zoom nobody could name.

// Slides abut exactly. There used to be a 24px black gutter here, to hide the
// luminance step where one slide's bright edge met the next slide's dark one —
// but a gutter does not remove a step, it fills it with black, which on a phone
// is a black bar sliding through the middle of every swipe. Reported as
// "borders" three times, through three different attempted fixes.
// It is gone at its source now: HeroSlide's scrim runs bottom-to-top instead of
// left-to-right, so it is constant along x and every slide is treated identically
// edge to edge. There is no step left to hide.
const SLIDE_GAP = 0

// How far a finger may travel and still count as a tap rather than a swipe.
// Comfortably under framer's own 3px drag threshold doubled — a deliberate
// swipe covers tens of pixels, a thumb pressing a button covers a handful.
const TAP_SLOP = 12

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

// The memo boundary between the carousel's own state and the slide subtrees.
//
// `cloneElement` mints a NEW element every time this component renders, so
// without a boundary every carousel re-render reconciled all three mounted
// slides in full — and a slide is not cheap (backdrop, trailer preview, copy,
// rating row, three buttons). The carousel re-renders far more often than a
// slide actually changes: drag start, drag end, the pause registry when a
// trailer arms, the deferred mount window, the 3s interaction timeout. None of
// those alter a single slide prop.
//
// Memoised, only the two slides whose `active` genuinely flips re-render, and
// only on an index change. Everything else stops at this boundary. `child` is
// referentially stable because `childrenArray` is memoised on the `children`
// prop — recomputing it per render would defeat this entirely.
const SlideContent = React.memo(function SlideContent({
  child,
  active,
}: {
  child: React.ReactNode
  active: boolean
}) {
  if (!React.isValidElement(child)) return <>{child}</>
  return React.cloneElement(child as React.ReactElement<{ active?: boolean }>, {
    active,
  })
})

export function Carousel({
  children,
  autoPlay = true,
  autoPlayInterval = 5000,
  stageClassName = '',
}: CarouselProps) {
  // Memoised, not recomputed: toArray re-keys and therefore RE-CREATES every
  // child element, which would hand SlideContent a new `child` prop on every
  // render and make the memo above a no-op.
  const childrenArray = React.useMemo(
    () => React.Children.toArray(children),
    [children]
  )
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
    // Reduced-motion turns the rotation OFF, not just the spring. It was only
    // wired to `settle` here, so a visitor who had asked for less motion still
    // got a hero that changed under them every 5s — the biggest movement on the
    // page, and the one WCAG 2.2.2 is actually about. It also stops the deck
    // pulling a fresh full-width backdrop every interval for someone who never
    // asked to be shown one.
    autoPlay: autoPlay && !reduce,
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

  // Which slide the mounted WINDOW is centred on. Deliberately lags
  // currentIndex, and that lag is the point.
  //
  // Advancing the index shifts the window, so one brand-new slide mounts on the
  // very commit that starts the spring: a full HeroSlide subtree renders, and
  // the browser lays out and decodes a backdrop it has never seen, all inside
  // the frame that is supposed to begin the motion. That was the last long
  // frame left after the image-size fix — 293ms on a 6x-throttled phone.
  //
  // useDeferredValue splits it in two. The urgent render keeps the OLD window,
  // which is exactly the set the transition needs: the outgoing slide (now at
  // offset -1) and the incoming one (offset 0) are both already mounted and
  // decoded, and the slide that drops to offset -2 is clipped off-stage where
  // nobody can see it. The new neighbour arrives on the follow-up low-priority
  // render, once the spring is already running.
  //
  // Nothing visible is deferred — only the off-stage prefetch is.
  const mountIndex = React.useDeferredValue(currentIndex)

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

  // Returning the track to rest. Deliberately NOT tracked in React state.
  //
  // There used to be a `moving` boolean here, set on drag start and cleared when
  // the spring resolved, purely to fade the old edge overlays in and out. It
  // cost two full re-renders of the carousel — and therefore of all three
  // mounted slides — on every single swipe, one of them landing exactly as the
  // spring started. The edges are sealed in CSS now and nothing needs to know
  // whether the track is moving, so the renders go with it. The whole gesture is
  // now motion-value driven: React does not re-render at all between the index
  // change and the spring finishing.
  const settle = React.useCallback(() => {
    if (reduce) {
      x.jump(0)
      return undefined
    }
    return animate(x, 0, SLIDE_SPRING)
  }, [reduce, x])

  // Where the finger let go, frozen at pointerup. The effect below cannot just
  // read x.get(): a paginating release re-renders a whole slide before React
  // commits, and x has measurably drifted by then (-240 at release, -119 by the
  // time the effect ran), which lands the compensation short.
  const releaseXRef = React.useRef<number | null>(null)

  const trackRef = React.useRef<HTMLDivElement>(null)

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

  // WHAT IS REACHABLE IS DECIDED BY GEOMETRY, AND ONLY BY GEOMETRY.
  //
  // This is the structural fix for a bug that came back three times, because
  // every version of it was a different guess at the same broken premise.
  //
  // The carousel had two answers to "which slide is on screen": currentIndex,
  // which flips instantly, and where the slides actually are, which is x plus
  // each slide's offset. Those two DISAGREE for the whole of every transition,
  // and not by accident — the layout effect above deliberately jumps the track a
  // full step so the frame does not move yet. So for ~400ms after every swipe
  // and every rotation, the slide filling the screen is the one the index has
  // already written off, and `inert` + `pointer-events: none` were derived from
  // the index. The hero you could see was not the hero you could touch.
  //
  // Patching the index with a lagging copy of itself failed twice: once waiting
  // on the spring's completion promise (flipped early), once on x reaching zero
  // (right, but still a second source of truth to keep in step). The premise was
  // the problem. A slide is reachable iff its box overlaps the frame, which is
  // exactly `|offset * step + x| < step` — true at every instant, mid-spring,
  // mid-drag or at rest, with nothing to synchronise.
  //
  // So this owns inert / aria-hidden / pointer-events outright and React sets
  // none of them. One writer, one rule, no timing. It runs off x's subscription
  // rather than React state, so a transition still costs zero re-renders — the
  // property the rest of this file is built around.
  //
  // It fails OPEN. Before the stage has been measured there is no geometry to
  // judge, and the failure mode we are eliminating is content you cannot touch,
  // so an unmeasured carousel is fully reachable rather than fully dead.
  const syncReachability = React.useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const step = widthRef.current + SLIDE_GAP
    const tx = x.get()
    for (const node of Array.from(track.children)) {
      const el = node as HTMLElement
      const offset = Number(el.dataset.offset)
      const reachable =
        step <= 0 || !Number.isFinite(offset)
          ? true
          : Math.abs(offset * step + tx) < step
      el.style.pointerEvents = reachable ? 'auto' : 'none'
      el.toggleAttribute('inert', !reachable)
      if (reachable) el.removeAttribute('aria-hidden')
      else el.setAttribute('aria-hidden', 'true')
    }
  }, [x])

  // Re-run on every commit (the offsets change with currentIndex) and on every
  // frame x moves.
  useIsoLayoutEffect(syncReachability)
  React.useEffect(() => x.on('change', syncReachability), [x, syncReachability])

  // A TAP ACTIVATES WHAT THE FINGER LANDED ON, not what happens to be under it
  // when the finger lifts.
  //
  // This is the last piece of the Watch-Now-does-nothing bug, and the one the
  // geometry rule below cannot supply on its own. syncReachability guarantees
  // the slide you can see is the slide you can TOUCH; it cannot stop that slide
  // from MOVING. For the ~300ms the spring is running the button is travelling
  // ~150px, and a touch is not a click: the browser hit-tests at touchdown and
  // again at lift, and dispatches the click to what the two have in common. Land
  // on Watch Now mid-flight and it has slid on by the time you lift, so the
  // click resolves to the slide behind it and nothing happens. Measured against
  // prod before this: a tap 0-250ms after a swipe release missed every time, and
  // only from ~300ms did it reliably land.
  //
  // Stopping the animation on touchdown was tried first and is WORSE: the finger
  // is aimed at where the button is drawn right now, so snapping the track home
  // teleports the target out from under a tap that had actually caught it.
  //
  // So the geometry is left entirely alone and the intent is honoured instead.
  // Remember the control under the finger at touchdown; if the finger hasn't
  // travelled far enough to be a swipe, suppress the browser's own click — which
  // is the one that hit-tests the wrong element — and activate the remembered
  // control directly. Nothing here cares where anything has moved to, so it
  // holds mid-spring, mid-autoplay-rotation, and for whatever motion comes next.
  const tapRef = React.useRef<{ el: HTMLElement; x: number; y: number } | null>(
    null
  )

  const onStageTouchStart = React.useCallback((e: React.TouchEvent) => {
    tapRef.current = null
    if (e.touches.length !== 1) return
    const target = e.target as HTMLElement | null
    // Only controls. A tap on artwork has nothing to activate, and leaving those
    // to the browser keeps this off every path it isn't needed on.
    const el = target?.closest?.(
      'a[href], button:not([disabled])'
    ) as HTMLElement | null
    if (!el) return
    const touch = e.touches[0]
    tapRef.current = { el, x: touch.clientX, y: touch.clientY }
  }, [])

  const onStageTouchEnd = React.useCallback((e: React.TouchEvent) => {
    const tap = tapRef.current
    tapRef.current = null
    if (!tap || e.changedTouches.length !== 1) return
    const touch = e.changedTouches[0]
    // Anything past the slop is a swipe (or a scroll) that happened to start on
    // a control — it must not navigate.
    if (Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > TAP_SLOP)
      return
    // The element may have left the document (a slide unmounting mid-gesture).
    if (!tap.el.isConnected) return
    e.preventDefault()
    tap.el.click()
  }, [])

  // Contain the browser's overscroll for exactly as long as a HORIZONTAL drag is
  // in progress, and no longer.
  //
  // The first version of this held from pointerdown, which was wrong in the one
  // place it mattered: the hero fills the top of the home screen, so every
  // pull-to-refresh starts with a finger on this stage — and the flag was
  // already set before the browser could read the gesture as a pull. Gating on
  // framer's drag threshold instead means a straight pull down never starts a
  // drag, never sets the flag, and refreshes normally; only a swipe that has
  // committed to the x axis suppresses the overscroll it would otherwise fight.
  //
  // Cleared on drag end and on unmount, because leaving it set would disable
  // pull-to-refresh for the rest of the session.
  // See the html[data-hero-dragging] rule in styles/globals.css.
  const holdOverscroll = React.useCallback((held: boolean) => {
    const root = document.documentElement
    if (held) root.setAttribute('data-hero-dragging', '')
    else root.removeAttribute('data-hero-dragging')
  }, [])

  // framer starts a drag on total distance travelled, not on distance along the
  // drag axis, so onDragStart fires for a straight pull down too — which is how
  // the first attempt still ate pull-to-refresh. dragDirectionLock resolves the
  // gesture to one axis and reports it here; only 'x' is ours.
  const onDirectionLock = React.useCallback(
    (axis: 'x' | 'y') => holdOverscroll(axis === 'x'),
    [holdOverscroll]
  )

  const onDragStart = handleDragStart

  // Drag initiation stays framer's own native pointerdown listener on the track.
  //
  // Taking it over with dragListener={false} + dragControls was tried here and
  // REVERTED. Routing the start through a React synthetic handler left the
  // carousel unswipeable for the first stretch after a page load — a worse,
  // more certain bug than the speculative one it was aimed at. Do not reach for
  // it again without a device that can actually render frames to prove it out.

  // A drag that doesn't cross the threshold never changes the index, so the
  // effect above won't run — this is what returns the track in that case. It has
  // to be exclusive: settling here as well when the release DOES paginate meant
  // this animation had already pulled x part-way home before the effect read it,
  // and the compensation landed short (172 wanted, 293 measured).
  const onDragEnd = React.useCallback(
    (event: PointerEvent, info: PanInfo) => {
      holdOverscroll(false)
      releaseXRef.current = x.get()
      if (handleDragEnd(event, info)) return
      releaseXRef.current = null
      settle()
    },
    [handleDragEnd, holdOverscroll, settle, x]
  )

  React.useEffect(() => () => holdOverscroll(false), [holdOverscroll])

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
        <SlideContent child={childrenArray[0]} active />
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
        // A phone has no hover, so nothing ever froze the rotation while a
        // finger was on its way to Watch Now — the slide could change out from
        // under the tap. A pointer going down on the stage freezes autoplay
        // exactly the way a mouse entering it does, and the release resumes on
        // the usual 3s delay.
        onPointerDown={handleHoverStart}
        onPointerUp={handleHoverEnd}
        onPointerCancel={handleHoverEnd}
        // See onStageTouchEnd — a tap activates the control it landed on, not
        // whatever the transition has slid under the finger by the time it lifts.
        onTouchStart={onStageTouchStart}
        onTouchEnd={onStageTouchEnd}
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
          ref={trackRef}
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          style={{
            x,
            touchAction: 'pan-y pinch-zoom',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          drag="x"
          dragMomentum={false}
          // Resolve every gesture to a single axis. A vertical pull then scrolls
          // the page (and pull-to-refreshes at the top) without the track
          // fighting it for the horizontal component.
          dragDirectionLock
          onDirectionLock={onDirectionLock}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          // Belt and braces: onDragEnd covers the normal release, but a flag
          // left set here would kill pull-to-refresh for the whole session.
          onPointerUp={() => holdOverscroll(false)}
          onPointerCancel={() => holdOverscroll(false)}
        >
          {/* Windowed slides, laid out side by side and placed INSTANTLY — plain
            divs, no animation of their own. Off-stage slides sit a full width
            away and are clipped by the container's overflow-hidden, so two
            slides can never be readable at once. Staying mounted keeps their
            artwork decoded before they scroll in. */}
          {childrenArray.map((child, i) => {
            // Position from the live index, mount from the lagging one. A slide
            // that has fallen outside the window but is still mounted simply
            // sits at ±2 widths, which the stage clips.
            const offset = wrappedOffset(i, currentIndex, childrenCount)
            const active = offset === 0
            // ...but the lagging window may NEVER unmount the slide on screen.
            // Normally it cannot: one step of the index leaves the new active
            // slide inside the old window. Several steps before React gets to
            // the deferred render — a flurry of fast swipes — would put it two
            // or more away, and the stage would paint its bare black base with
            // no slide in it at all. Measured as un-reproducible under a
            // 5-swipe burst at 4x throttle, which makes it exactly the kind of
            // thing that only shows up on someone's phone. One boolean.
            if (
              !active &&
              Math.abs(wrappedOffset(i, mountIndex, childrenCount)) > WINDOW
            )
              return null
            return (
              <motion.div
                key={i}
                // Each slide is 1px wider than the stage on BOTH sides, so
                // neighbours overlap instead of meeting. Abutting them exactly
                // is not actually exact: the stage is 393 CSS px on a phone at
                // dpr 3, so a half-way drag puts the join on device pixel 589.5
                // and the browser antialiases both edges against each other —
                // a one-pixel dark line that tracks the finger. No amount of
                // colour matching removes it, because it is a rasterisation
                // artifact, not a colour step. Overlapping by a pixel means
                // there is no boundary to antialias, and since both edges are
                // sealed to black the overlap itself cannot be seen.
                className="absolute inset-y-0 -right-px -left-px"
                // A slide is placed once and never animates. The track owns all
                // horizontal motion; anything else writing x broke the release
                // twice before, and there is no longer a second property being
                // animated here either.
                //
                // No `will-change` / `contain` on slides. Promoting each one to
                // its own compositor layer was tried and reverted: a promoted
                // layer that is also scaled gets resampled, which put coloured
                // fringes on the artwork and the title treatment — visible on a
                // real phone as lit borders around the wordmark. The one element
                // that should be promoted is the track, and framer already
                // promotes it because it animates a transform.
                style={{
                  x: `calc(${offset * 100}% + ${offset * SLIDE_GAP}px)`,
                  backfaceVisibility: 'hidden',
                }}
                initial={false}
                // Where this slide sits, in steps from the frame. The ONLY input
                // syncReachability needs — it pairs this with the live x to work
                // out what is actually on screen. React does not set
                // pointer-events / inert / aria-hidden here on purpose: those
                // have a single owner, and deriving them from the index is the
                // bug (see syncReachability).
                data-offset={offset}
              >
                {/* Tell the slide whether it's the one on screen, so touch devices
                  can autoplay the active slide's trailer preview (no hover). */}
                <SlideContent child={child} active={active} />
                {/* No edge overlays here any more — HeroSlide seals its own
                  edges permanently, so there is nothing to switch on and off as
                  the track moves. */}
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
              {/* Solid tint, NOT backdrop-blur. This pill sits over the stage
                and is always mounted, so a backdrop-filter here forces the
                compositor to re-blur what is behind it on every frame of every
                swipe. The arrows can afford one (lg: only, so no phone pays for
                it); this cannot. Opacity raised to keep the same legibility the
                blur was buying. */}
              <motion.span
                className="rounded-full bg-black/65 px-2 py-1 text-xs text-white/90 sm:text-sm"
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
