'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { PanInfo } from 'framer-motion'
import { useMounted } from '@/hooks/use-mounted'

interface UseCarouselProps {
  childrenCount: number
  autoPlay?: boolean
  autoPlayInterval?: number
}


export const useCarousel = ({
  childrenCount,
  autoPlay = true,
  autoPlayInterval = 5000,
}: UseCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const isMounted = useMounted()
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    if (!autoPlay || childrenCount <= 1 || isUserInteracting) return

    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current)
    }

    autoPlayRef.current = setInterval(() => {
      if (!isUserInteracting && !isDragging) {
        paginate(1)
      }
    }, autoPlayInterval)
  }, [autoPlay, autoPlayInterval, paginate, childrenCount, isUserInteracting, isDragging])

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current)
      autoPlayRef.current = null
    }
  }, [])

  const handleUserInteraction = useCallback(
    (interacting: boolean) => {
      setIsUserInteracting(interacting)

      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current)
      }

      if (interacting) {
        stopAutoPlay()
      } else {
        // Resume auto-play after a delay when user stops interacting
        userInteractionTimeoutRef.current = setTimeout(() => {
          setIsUserInteracting(false)
        }, 3000) // 3 seconds delay before resuming auto-play
      }
    },
    [stopAutoPlay]
  )

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
  const handleDragStart = useCallback((event: any, info: PanInfo) => {
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
  }, [handleUserInteraction])

  const handleDragEnd = useCallback((event: any, info: PanInfo) => {
    setIsDragging(false)

    // Much more intuitive thresholds
    const isMobile = window.innerWidth < 768
    const containerWidth = event.currentTarget?.offsetWidth || window.innerWidth

    // Percentage-based thresholds for better UX
    const distanceThreshold = containerWidth * (isMobile ? 0.12 : 0.15) // 12% on mobile, 15% on desktop
    const velocityThreshold = isMobile ? 250 : 400

    const velocity = Math.abs(info.velocity.x)
    const offset = info.offset.x
    const distance = Math.abs(offset)

    // More intuitive logic: either significant distance OR high velocity
    const hasSignificantDistance = distance > distanceThreshold
    const hasHighVelocity = velocity > velocityThreshold

    const shouldChangeSlide = hasSignificantDistance || hasHighVelocity

    if (shouldChangeSlide) {
      // Immediate transition for better responsiveness
      if (offset > 0) {
        paginate(-1) // Swipe right, go to previous
      } else {
        paginate(1) // Swipe left, go to next
      }
    }

    // Resume auto-play after user interaction delay
    setTimeout(() => {
      handleUserInteraction(false)
    }, 50)
  }, [paginate, handleUserInteraction])

  const handleHoverStart = useCallback(() => {
    handleUserInteraction(true)
  }, [handleUserInteraction])

  const handleHoverEnd = useCallback(() => {
    handleUserInteraction(false)
  }, [handleUserInteraction])

  const handleButtonClick = useCallback((newDirection: number) => {
    handleUserInteraction(true)
    paginate(newDirection)
    handleUserInteraction(false)
  }, [handleUserInteraction, paginate])

  const handleDotClick = useCallback((index: number) => {
    handleUserInteraction(true)
    setDirection(index > currentIndex ? 1 : -1)
    setCurrentIndex(index)
    handleUserInteraction(false)
  }, [currentIndex, handleUserInteraction])

  return {
    currentIndex,
    direction,
    isUserInteracting,
    isDragging,
    isMounted,
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