'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, PanInfo } from 'framer-motion'

interface CarouselProps {
  children: React.ReactNode
  autoPlay?: boolean
  autoPlayInterval?: number
}

export function Carousel({
  children,
  autoPlay = true,
  autoPlayInterval = 5000,
}: CarouselProps) {
  const childrenArray = React.Children.toArray(children)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const paginate = useCallback(
    (newDirection: number) => {
      setDirection(newDirection)
      setCurrentIndex((prevIndex) => {
        if (newDirection > 0) {
          return prevIndex === childrenArray.length - 1 ? 0 : prevIndex + 1
        } else {
          return prevIndex === 0 ? childrenArray.length - 1 : prevIndex - 1
        }
      })
    },
    [childrenArray.length]
  )

  // Enhanced auto-play with user interaction handling
  const startAutoPlay = useCallback(() => {
    if (!autoPlay || childrenArray.length <= 1 || isUserInteracting) return

    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current)
    }

    autoPlayRef.current = setInterval(() => {
      if (!isUserInteracting && !isDragging) {
        paginate(1)
      }
    }, autoPlayInterval)
  }, [
    autoPlay,
    autoPlayInterval,
    paginate,
    childrenArray.length,
    isUserInteracting,
    isDragging,
  ])

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
    startAutoPlay()
    return () => stopAutoPlay()
  }, [startAutoPlay, stopAutoPlay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current)
      if (userInteractionTimeoutRef.current)
        clearTimeout(userInteractionTimeoutRef.current)
    }
  }, [])

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 1,
      scale: 0.98,
      rotateY: direction * 2,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 1,
      scale: 0.98,
      rotateY: direction * -2,
    }),
  }

  // Enhanced drag handling with much better UX
  const handleDragStart = (event: any, info: PanInfo) => {
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
  }
  const handleDragEnd = (event: any, info: PanInfo) => {
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
  }

  const handleHoverStart = () => {
    handleUserInteraction(true)
  }

  const handleHoverEnd = () => {
    handleUserInteraction(false)
  }

  const handleButtonClick = (newDirection: number) => {
    handleUserInteraction(true)
    paginate(newDirection)
    handleUserInteraction(false)
  }

  const handleDotClick = (index: number) => {
    handleUserInteraction(true)
    setDirection(index > currentIndex ? 1 : -1)
    setCurrentIndex(index)
    handleUserInteraction(false)
  }

  if (childrenArray.length === 0) {
    return null
  }

  if (childrenArray.length === 1) {
    return <div className="relative overflow-hidden">{childrenArray[0]}</div>
  }
  return (
    <div
      className="group relative overflow-hidden transition-opacity duration-300"
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      style={{
        minHeight: 'var(--carousel-height, auto)',
      }}
    >
      {' '}
      {/* Background container to prevent blank screen */}
      <div className="absolute inset-0 z-0 transition-opacity duration-150">
        {childrenArray[currentIndex]}
      </div>
      {/* Main animated slide container */}
      <AnimatePresence mode="popLayout" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: {
              type: 'spring',
              stiffness: isDragging ? 600 : 400,
              damping: isDragging ? 35 : 40,
              mass: isDragging ? 0.3 : 0.6,
            },
            opacity: {
              duration: isDragging ? 0.1 : 0.25,
              ease: [0.25, 0.46, 0.45, 0.94],
            },
            scale: {
              duration: isDragging ? 0.1 : 0.25,
              ease: [0.25, 0.46, 0.45, 0.94],
            },
            rotateY: {
              type: 'spring',
              stiffness: 500,
              damping: 30,
            },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.08}
          dragMomentum={false}
          dragTransition={{
            bounceStiffness: 1000,
            bounceDamping: 50,
            power: 0.2,
            timeConstant: 600,
          }}
          whileDrag={{
            scale: 0.97,
            rotateY: direction * 1.5,
            cursor: 'grabbing',
            transition: {
              duration: 0.1,
              ease: 'easeOut',
            },
          }}
          whileHover={{
            scale: 1.01,
            transition: { duration: 0.2 },
          }}
          whileTap={{
            scale: 0.98,
            transition: { duration: 0.1 },
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="relative z-20 cursor-grab select-none will-change-transform active:cursor-grabbing"
          style={{
            touchAction: 'pan-y pinch-zoom',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            backfaceVisibility: 'hidden',
            perspective: '1000px',
            transform: 'translateZ(0)', // Force hardware acceleration
            WebkitTransform: 'translateZ(0)',
          }}
        >
          {' '}
          <div className="pointer-events-auto transform-gpu will-change-transform">
            {childrenArray[currentIndex]}
          </div>
        </motion.div>
      </AnimatePresence>{' '}
      {/* Enhanced Navigation Dots - Always visible for easy navigation */}
      {childrenArray.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 px-2 sm:bottom-6 sm:px-4">
          {/* For small number of slides - show all dots */}
          {childrenArray.length <= 15 && (
            <div className="flex max-w-[90vw] flex-wrap justify-center gap-1.5 sm:max-w-none sm:gap-2">
              {childrenArray.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`size-2.5 rounded-full transition-all duration-300 hover:scale-110 sm:size-3 ${
                    index === currentIndex
                      ? 'scale-110 bg-white shadow-lg ring-2 ring-white/30 sm:scale-125'
                      : 'bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* For large number of slides - show pagination with truncation */}
          {childrenArray.length > 15 && (
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {/* First page */}
              <button
                onClick={() => handleDotClick(0)}
                className={`size-2.5 rounded-full transition-all duration-300 hover:scale-110 sm:size-3 ${
                  0 === currentIndex
                    ? 'scale-110 bg-white shadow-lg ring-2 ring-white/30 sm:scale-125'
                    : 'bg-white/40 hover:bg-white/70'
                }`}
                aria-label="Go to first slide"
              />{' '}
              {/* Show dots around current position */}
              {currentIndex > 3 && (
                <>
                  <span className="px-1 text-xs text-white/60">...</span>
                </>
              )}
              {/* Show 5 dots around current position */}
              {Array.from(
                { length: Math.min(5, childrenArray.length) },
                (_, i) => {
                  const startIndex = Math.max(
                    1,
                    Math.min(currentIndex - 2, childrenArray.length - 6)
                  )
                  const index = startIndex + i

                  if (index >= childrenArray.length - 1 || index <= 0)
                    return null

                  return (
                    <button
                      key={index}
                      onClick={() => handleDotClick(index)}
                      className={`size-2.5 rounded-full transition-all duration-300 hover:scale-110 sm:size-3 ${
                        index === currentIndex
                          ? 'scale-110 bg-white shadow-lg ring-2 ring-white/30 sm:scale-125'
                          : 'bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  )
                }
              )}{' '}
              {/* Show ellipsis if there are more slides */}
              {currentIndex < childrenArray.length - 4 && (
                <>
                  <span className="px-1 text-xs text-white/60">...</span>
                </>
              )}
              {/* Last page */}
              <button
                onClick={() => handleDotClick(childrenArray.length - 1)}
                className={`size-2.5 rounded-full transition-all duration-300 hover:scale-110 sm:size-3 ${
                  childrenArray.length - 1 === currentIndex
                    ? 'scale-110 bg-white shadow-lg ring-2 ring-white/30 sm:scale-125'
                    : 'bg-white/40 hover:bg-white/70'
                }`}
                aria-label="Go to last slide"
              />{' '}
            </div>
          )}

          {/* Current position indicator */}
          <div className="my-2 text-center">
            <span className="rounded-full bg-black/50 px-2 py-1 text-xs text-white/90 backdrop-blur-xs sm:text-sm">
              {currentIndex + 1} / {childrenArray.length}
            </span>
          </div>
        </div>
      )}
      {/* Navigation arrows - responsive */}
      {childrenArray.length > 1 && (
        <>
          {' '}
          {/* Left Arrow */}
          <button
            onClick={() => handleButtonClick(-1)}
            className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 transition-all duration-200 hover:bg-black/50 focus:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-white/50 group-hover:opacity-100 sm:left-4 sm:p-2 lg:opacity-0"
            aria-label="Previous slide"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="sm:size-6"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {/* Right Arrow */}
          <button
            onClick={() => handleButtonClick(1)}
            className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 transition-all duration-200 hover:bg-black/50 focus:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-white/50 group-hover:opacity-100 sm:right-4 sm:p-2 lg:opacity-0"
            aria-label="Next slide"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="sm:size-6"
            >
              <path
                d="M9 18L15 12L9 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>{' '}
          {/* Mobile-only swipe indicator with better positioning */}
          {!isDragging && (
            <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 text-center sm:bottom-20 lg:hidden">
              <div className="animate-pulse rounded-full bg-black/30 px-3 py-1.5 text-xs text-white/80 backdrop-blur-xs">
                👆 Swipe to navigate
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
