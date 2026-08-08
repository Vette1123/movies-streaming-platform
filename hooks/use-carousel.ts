'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PanInfo } from 'framer-motion'

import { useMounted } from '@/hooks/use-mounted'

interface UseCarouselProps {
  childrenCount: number
  autoPlay?: boolean
  autoPlayInterval?: number
  // Hard pause requested by a slide (e.g. a trailer is playing/loading). Takes
  // precedence over autoplay regardless of hover state, so rotation can never
  // yank a slide out from under an open trailer.
  externalPaused?: boolean
}

export const useCarousel = ({
  childrenCount,
  autoPlay = true,
  autoPlayInterval = 5000,
  externalPaused = false,
}: UseCarouselProps) => {
  // Always start at slide 0 on load. The server renders slide 0 (the priority /
  // LCP image), so the first frame is correct and decoded fast — no restore
  // jump, no flash. Slide 0 is also the freshest trending title.
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const [isTabHidden, setIsTabHidden] = useState(false)
  const isMounted = useMounted()

  // Once the visitor drives the carousel themselves, it stops driving itself —
  // permanently, for the life of the page.
  //
  // Everything else here is a TEMPORARY pause that resumes after 3s, and that
  // is what keeps putting a rotation underneath a finger: you swipe to the
  // title you want, reach for Watch Now, and the hero advances between your eye
  // choosing the target and your thumb reaching it. The tap then lands on a
  // slide mid-flight and does nothing, which is exactly the "I have to tap it
  // twice" report. No timing fix can close that gap — a moving target is the
  // problem, so once you have shown you are steering, the carousel stops moving
  // on its own. WCAG 2.2.2 asks for auto-updating content to be stoppable
  // anyway, and a hero the visitor has already engaged with has no business
  // rotating away from them.
  const [userTookOver, setUserTookOver] = useState(false)

  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // A ref, not state, and nothing outside this hook reads it. It used to be
  // state, which meant a swipe forced a React render at pointerdown and another
  // at pointerup — both landing on the frames that have the least budget to
  // spare, and both re-rendering the whole carousel for a flag no rendered
  // output depends on. `isPaused` never needed it either: every path that sets
  // it also calls handleUserInteraction(true) in the same batch, and the 3s
  // resume delay keeps isUserInteracting true well past the release. The
  // autoplay interval reads it live here, which is more correct than the stale
  // closure copy it used to read.
  const isDraggingRef = useRef(false)

  // Pause autoplay while the tab is backgrounded. No point rotating (and firing
  // slide-view work) when nobody's looking, and it stops a flurry of catch-up
  // advances the moment the tab regains focus.
  useEffect(() => {
    const onVisibility = () => setIsTabHidden(document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Memoized values for performance
  const hasMultipleSlides = useMemo(() => childrenCount > 1, [childrenCount])
  // How many dots fit on ONE row of a phone, not how many are "a lot".
  //
  // This was 15, and 15 dots have never fitted a 390px screen: the row is
  // `flex-wrap` inside `max-w-[90vw]`, so past ~8 it wraps to a second and third
  // line and grows UPWARD into the hero's Watch Now / Trailer / Save buttons.
  // Nothing caught it because the hero shipped 20 slides, which took the
  // truncated branch below; cutting the deck to 12 (lib/constants.ts) dropped it
  // under the old threshold and into a layout that never worked. 8 is measured
  // against the narrow case — ~12px per dot plus the wider active one, inside
  // 90vw of 390px — so anything larger paginates instead of wrapping.
  const showAllDots = useMemo(() => childrenCount <= 8, [childrenCount])

  const paginate = useCallback(
    (newDirection: number) => {
      setCurrentIndex((prevIndex) => {
        if (newDirection > 0) {
          return prevIndex === childrenCount - 1 ? 0 : prevIndex + 1
        } else {
          return prevIndex === 0 ? childrenCount - 1 : prevIndex - 1
        }
      })
    },
    [childrenCount]
  )

  // Enhanced auto-play with user interaction handling
  const startAutoPlay = useCallback(() => {
    if (
      !autoPlay ||
      childrenCount <= 1 ||
      userTookOver ||
      isUserInteracting ||
      isTabHidden ||
      externalPaused
    )
      return

    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current)
    }

    autoPlayRef.current = setInterval(() => {
      if (!isUserInteracting && !isDraggingRef.current && !document.hidden) {
        paginate(1)
      }
    }, autoPlayInterval)
  }, [
    autoPlay,
    autoPlayInterval,
    paginate,
    childrenCount,
    userTookOver,
    isUserInteracting,
    isTabHidden,
    externalPaused,
  ])

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current)
      autoPlayRef.current = null
    }
  }, [])

  // The interval is owned entirely by the effect below, which re-runs whenever
  // isUserInteracting changes. This must NOT clear the interval imperatively:
  // handleButtonClick/handleDotClick call this with true then false in the same
  // tick, React batches that into no net state change, so the effect never
  // re-ran — the imperative stop killed autoplay permanently the first time you
  // touched an arrow or a dot. Only the flag moves here; the effect does the
  // rest, so a batched true→false is simply a no-op instead of a one-way door.
  const handleUserInteraction = useCallback((interacting: boolean) => {
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current)
    }

    if (interacting) {
      setIsUserInteracting(true)
    } else {
      // Resume auto-play after a delay when user stops interacting
      userInteractionTimeoutRef.current = setTimeout(() => {
        setIsUserInteracting(false)
      }, 3000) // 3 seconds delay before resuming auto-play
    }
  }, [])

  // Auto-play effect
  useEffect(() => {
    if (isMounted) {
      startAutoPlay()
    }
    return () => stopAutoPlay()
  }, [startAutoPlay, stopAutoPlay, isMounted])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current)
      if (userInteractionTimeoutRef.current)
        clearTimeout(userInteractionTimeoutRef.current)
    }
  }, [])

  // By the time this runs the gesture is already a real drag, so there is
  // nothing left to veto here.
  //
  // This used to open with a `target.closest('button, a, …')` check and
  // `return false // Prevent drag`. framer-motion never reads what onDragStart
  // returns, so that guard did nothing for as long as it existed — and taps on
  // the hero's own buttons kept arming a drag, which is what made them
  // intermittently do nothing on touch. The decision now happens where it can
  // actually be enforced: the carousel starts the drag itself via dragControls
  // and simply doesn't start one on an interactive target (see
  // startDragUnlessInteractive in components/carousel.tsx).
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
    handleUserInteraction(true)
  }, [handleUserInteraction])

  const handleDragEnd = useCallback(
    (event: any, info: PanInfo) => {
      isDraggingRef.current = false
      // You are steering now — see userTookOver.
      setUserTookOver(true)

      // Measure the stage, not the event target. This used to read
      // `event.currentTarget.offsetWidth`, but on a pointerup React has already
      // finished dispatch and currentTarget is null, so it always fell through to
      // the window width — which is wider than the stage on desktop and made the
      // distance threshold harder to reach than intended.
      const stage = (event?.target as HTMLElement | null)?.closest?.(
        '[data-carousel-stage]'
      ) as HTMLElement | null
      const containerWidth = stage?.offsetWidth || window.innerWidth
      const isMobile = window.innerWidth < 768

      // Percentage-based thresholds for better UX
      const distanceThreshold = containerWidth * (isMobile ? 0.12 : 0.15) // 12% on mobile, 15% on desktop
      const velocityThreshold = isMobile ? 250 : 400

      const velocity = Math.abs(info.velocity.x)
      const offset = info.offset.x
      const distance = Math.abs(offset)

      // Distance OR flick. Both are direction-checked against the SAME value
      // below, so a fast flick that ends near where it started still goes the way
      // the finger was moving.
      const hasSignificantDistance = distance > distanceThreshold
      const hasHighVelocity = velocity > velocityThreshold

      const shouldChangeSlide = hasSignificantDistance || hasHighVelocity

      if (shouldChangeSlide) {
        // A flick can end with almost no offset, so let velocity decide the
        // direction when the distance is too small to be meaningful — otherwise a
        // quick flick left could paginate right off a couple of stray pixels.
        //
        // Both are POSITIVE when the finger moved right, which is what the check
        // below reads. This used to negate the velocity, which inverted every
        // gesture that fell under the distance threshold: a flick right paged
        // forward instead of back. Desktop felt worse than touch because its
        // threshold is 15% of a much wider stage, so nearly every mouse swipe
        // took this branch.
        const direction = hasSignificantDistance ? offset : info.velocity.x
        if (direction > 0) {
          paginate(-1) // Swipe right, go to previous
        } else {
          paginate(1) // Swipe left, go to next
        }
      }

      // Resume auto-play after user interaction delay
      setTimeout(() => {
        handleUserInteraction(false)
      }, 50)

      // Tells the caller whether an index change is coming. The carousel needs
      // this to decide who returns the track to rest: on a paginating release
      // the index-change effect does it (and must be the ONLY thing touching x,
      // or it reads a value that has already drifted); on a release that stays
      // put, nothing else will, so the caller settles it itself.
      return shouldChangeSlide
    },
    [paginate, handleUserInteraction]
  )

  const handleHoverStart = useCallback(() => {
    handleUserInteraction(true)
  }, [handleUserInteraction])

  const handleHoverEnd = useCallback(() => {
    handleUserInteraction(false)
  }, [handleUserInteraction])

  const handleButtonClick = useCallback(
    (newDirection: number) => {
      setUserTookOver(true)
      handleUserInteraction(true)
      paginate(newDirection)
      handleUserInteraction(false)
    },
    [handleUserInteraction, paginate]
  )

  const handleDotClick = useCallback(
    (index: number) => {
      setUserTookOver(true)
      handleUserInteraction(true)
      setCurrentIndex(index)
      handleUserInteraction(false)
    },
    // No longer depends on currentIndex, so this callback is now stable for the
    // life of the carousel — the dot row stops getting fresh handlers on every
    // slide change.
    [handleUserInteraction]
  )

  return {
    currentIndex,
    isUserInteracting,
    isMounted,
    // For the autoplay progress bar: freeze it whenever the timer isn't running.
    isPaused: isUserInteracting || isTabHidden || externalPaused,
    hasMultipleSlides,
    showAllDots,
    paginate,
    handleDragStart,
    handleDragEnd,
    handleHoverStart,
    handleHoverEnd,
    handleButtonClick,
    handleDotClick,
  }
}
