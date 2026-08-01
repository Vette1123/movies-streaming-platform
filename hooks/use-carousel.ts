'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanInfo } from 'framer-motion'

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
  const [direction, setDirection] = useState(0)
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isTabHidden, setIsTabHidden] = useState(false)
  const isMounted = useMounted()

  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
  const showAllDots = useMemo(() => childrenCount <= 15, [childrenCount])

  const paginate = useCallback(
    (newDirection: number) => {
      setDirection(newDirection)
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
      isUserInteracting ||
      isTabHidden ||
      externalPaused
    )
      return

    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current)
    }

    autoPlayRef.current = setInterval(() => {
      if (!isUserInteracting && !isDragging && !document.hidden) {
        paginate(1)
      }
    }, autoPlayInterval)
  }, [
    autoPlay,
    autoPlayInterval,
    paginate,
    childrenCount,
    isUserInteracting,
    isDragging,
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

  // Enhanced drag handling with much better UX
  const handleDragStart = useCallback(
    (event: any, info: PanInfo) => {
      // Prevent drag if user is interacting with buttons or clickable elements
      const target = event.target as HTMLElement
      const isInteractiveElement = target.closest(
        'button, a, input, select, textarea, [role="button"]'
      )

      if (isInteractiveElement) {
        return false // Prevent drag
      }

      setIsDragging(true)
      handleUserInteraction(true)
    },
    [handleUserInteraction]
  )

  const handleDragEnd = useCallback(
    (event: any, info: PanInfo) => {
      setIsDragging(false)

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
      handleUserInteraction(true)
      paginate(newDirection)
      handleUserInteraction(false)
    },
    [handleUserInteraction, paginate]
  )

  const handleDotClick = useCallback(
    (index: number) => {
      handleUserInteraction(true)
      setDirection(index > currentIndex ? 1 : -1)
      setCurrentIndex(index)
      handleUserInteraction(false)
    },
    [currentIndex, handleUserInteraction]
  )

  return {
    currentIndex,
    direction,
    isUserInteracting,
    isDragging,
    isMounted,
    // For the autoplay progress bar: freeze it whenever the timer isn't running.
    isPaused: isUserInteracting || isDragging || isTabHidden || externalPaused,
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
