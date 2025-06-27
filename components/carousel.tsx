'use client'

import React, { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCarousel } from '@/hooks/use-carousel'
import {
  CAROUSEL_SLIDE_VARIANTS,
  CAROUSEL_BACKGROUND_VARIANTS,
  CAROUSEL_PLACEHOLDER_VARIANTS,
  CAROUSEL_SINGLE_SLIDE_VARIANTS,
  CAROUSEL_NAVIGATION_VARIANTS,
  CAROUSEL_DOT_VARIANTS,
  CAROUSEL_ARROW_VARIANTS,
  CAROUSEL_ARROW_ICON_VARIANTS,
  CAROUSEL_CONTENT_VARIANTS,
  CAROUSEL_POSITION_INDICATOR_VARIANTS,
  CAROUSEL_POSITION_TEXT_VARIANTS,
  CAROUSEL_ELLIPSIS_VARIANTS,
  CAROUSEL_SLIDE_TRANSITION,
  CAROUSEL_BACKGROUND_TRANSITION,
  CAROUSEL_DRAG_CONSTRAINTS,
  CAROUSEL_DRAG_TRANSITION,
  CAROUSEL_WHILE_DRAG,
  CAROUSEL_WHILE_HOVER,
  CAROUSEL_WHILE_TAP,
} from '@/lib/motion-variants'

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
  const childrenCount = useMemo(() => childrenArray.length, [childrenArray.length])

  const {
    currentIndex,
    direction,
    isDragging,
    isMounted,
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
  })

  // Memoized slide transition for performance
  const slideTransition = useMemo(() => CAROUSEL_SLIDE_TRANSITION(isDragging), [isDragging])

  if (childrenCount === 0) {
    return null
  }

  if (childrenCount === 1) {
    return (
      <motion.div 
        className="relative overflow-hidden"
        {...CAROUSEL_SINGLE_SLIDE_VARIANTS}
      >
        {childrenArray[0]}
      </motion.div>
    )
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
      {/* Instant placeholder background to prevent blank screen */}
      <motion.div 
        className="absolute inset-0 z-0 bg-gradient-to-br from-gray-800/80 via-gray-900/90 to-black/95"
        variants={CAROUSEL_PLACEHOLDER_VARIANTS}
        initial="initial"
        animate={isMounted ? "loaded" : "initial"}
      />

      {/* Multi-layered background for seamless transitions */}
      <div className="absolute inset-0 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${currentIndex}`}
            variants={CAROUSEL_BACKGROUND_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={CAROUSEL_BACKGROUND_TRANSITION}
            className="absolute inset-0"
          >
            {childrenArray[currentIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Main animated slide container with enhanced effects */}
      <AnimatePresence mode="popLayout" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={CAROUSEL_SLIDE_VARIANTS}
          initial={isMounted ? "enter" : "center"}
          animate="center"
          exit="exit"
          transition={slideTransition}
          drag="x"
          dragConstraints={CAROUSEL_DRAG_CONSTRAINTS}
          dragElastic={0.06}
          dragMomentum={false}
          dragTransition={CAROUSEL_DRAG_TRANSITION}
          whileDrag={CAROUSEL_WHILE_DRAG(direction)}
          whileHover={CAROUSEL_WHILE_HOVER}
          whileTap={CAROUSEL_WHILE_TAP}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="relative z-20 cursor-grab select-none will-change-transform active:cursor-grabbing"
          style={{
            touchAction: 'pan-y pinch-zoom',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            backfaceVisibility: 'hidden',
            perspective: '1200px',
            transform: 'translateZ(0)', // Force hardware acceleration
            WebkitTransform: 'translateZ(0)',
          }}
        >
          <motion.div 
            className="pointer-events-auto transform-gpu will-change-transform"
            {...CAROUSEL_CONTENT_VARIANTS}
          >
            {childrenArray[currentIndex]}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Enhanced Navigation Dots with smooth animations */}
      {hasMultipleSlides && (
        <motion.div 
          className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 px-2 sm:bottom-6 sm:px-4"
          variants={CAROUSEL_NAVIGATION_VARIANTS}
          initial="initial"
          animate={CAROUSEL_NAVIGATION_VARIANTS.animate(isMounted)}
          transition={CAROUSEL_NAVIGATION_VARIANTS.transition}
        >
          {/* For small number of slides - show all dots */}
          {showAllDots && (
            <div className="flex max-w-[90vw] flex-wrap justify-center gap-1.5 sm:max-w-none sm:gap-2">
              {childrenArray.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`size-2.5 cursor-pointer rounded-full transition-all duration-300 hover:scale-110 sm:size-3 ${
                    index === currentIndex
                      ? 'scale-110 bg-white shadow-lg ring-2 ring-white/30 sm:scale-125'
                      : 'bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                  variants={CAROUSEL_DOT_VARIANTS}
                  initial="initial"
                  animate={CAROUSEL_DOT_VARIANTS.animate(isMounted)}
                  whileHover="hover"
                  whileTap="tap"
                  transition={CAROUSEL_DOT_VARIANTS.transition(index)}
                />
              ))}
            </div>
          )}

          {/* For large number of slides - show pagination with truncation */}
          {!showAllDots && (
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {/* First page */}
              <motion.button
                onClick={() => handleDotClick(0)}
                className={`size-2.5 cursor-pointer rounded-full transition-all duration-300 hover:scale-110 sm:size-3 ${
                  0 === currentIndex
                    ? 'scale-110 bg-white shadow-lg ring-2 ring-white/30 sm:scale-125'
                    : 'bg-white/40 hover:bg-white/70'
                }`}
                aria-label="Go to first slide"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />

              {/* Show dots around current position */}
              {currentIndex > 3 && (
                <motion.span 
                  className="px-1 text-xs text-white/60"
                  variants={CAROUSEL_ELLIPSIS_VARIANTS}
                  initial="initial"
                  animate={CAROUSEL_ELLIPSIS_VARIANTS.animate(isMounted)}
                  transition={CAROUSEL_ELLIPSIS_VARIANTS.transition}
                >
                  ...
                </motion.span>
              )}

              {/* Show 5 dots around current position */}
              {Array.from(
                { length: Math.min(5, childrenCount) },
                (_, i) => {
                  const startIndex = Math.max(
                    1,
                    Math.min(currentIndex - 2, childrenCount - 6)
                  )
                  const index = startIndex + i

                  if (index >= childrenCount - 1 || index <= 0)
                    return null

                  return (
                    <motion.button
                      key={index}
                      onClick={() => handleDotClick(index)}
                      className={`size-2.5 cursor-pointer rounded-full transition-all duration-300 hover:scale-110 sm:size-3 ${
                        index === currentIndex
                          ? 'scale-110 bg-white shadow-lg ring-2 ring-white/30 sm:scale-125'
                          : 'bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    />
                  )
                }
              )}

              {/* Show ellipsis if there are more slides */}
              {currentIndex < childrenCount - 4 && (
                <motion.span 
                  className="px-1 text-xs text-white/60"
                  variants={CAROUSEL_ELLIPSIS_VARIANTS}
                  initial="initial"
                  animate={CAROUSEL_ELLIPSIS_VARIANTS.animate(isMounted)}
                  transition={CAROUSEL_ELLIPSIS_VARIANTS.transition}
                >
                  ...
                </motion.span>
              )}

              {/* Last page */}
              <motion.button
                onClick={() => handleDotClick(childrenCount - 1)}
                className={`size-2.5 cursor-pointer rounded-full transition-all duration-300 hover:scale-110 sm:size-3 ${
                  childrenCount - 1 === currentIndex
                    ? 'scale-110 bg-white shadow-lg ring-2 ring-white/30 sm:scale-125'
                    : 'bg-white/40 hover:bg-white/70'
                }`}
                aria-label="Go to last slide"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
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
            className="absolute left-3 top-1/2 z-30 -translate-y-1/2 hidden items-center justify-center size-10 rounded-full bg-white/10 backdrop-blur-md text-white opacity-0 transition-all duration-300 hover:bg-white/20 hover:scale-105 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/30 group-hover:opacity-100 sm:left-6 sm:size-12 lg:flex lg:opacity-0 shadow-lg border border-white/20"
            aria-label="Previous slide"
            variants={CAROUSEL_ARROW_VARIANTS}
            initial={CAROUSEL_ARROW_VARIANTS.initial('left')}
            animate="animate"
            whileHover="hover"
            whileTap="tap"
            transition={CAROUSEL_ARROW_VARIANTS.transition}
          >
            <motion.div
              variants={CAROUSEL_ARROW_ICON_VARIANTS}
              whileHover={CAROUSEL_ARROW_ICON_VARIANTS.hover('left')}
              transition={CAROUSEL_ARROW_ICON_VARIANTS.transition}
            >
              <ChevronLeft className="size-5 sm:size-6" strokeWidth={2.5} />
            </motion.div>
          </motion.button>

          {/* Right Arrow */}
          <motion.button
            onClick={() => handleButtonClick(1)}
            className="absolute right-3 top-1/2 z-30 -translate-y-1/2 hidden items-center justify-center size-10 rounded-full bg-white/10 backdrop-blur-md text-white opacity-0 transition-all duration-300 hover:bg-white/20 hover:scale-105 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/30 group-hover:opacity-100 sm:right-6 sm:size-12 lg:flex lg:opacity-0 shadow-lg border border-white/20"
            aria-label="Next slide"
            variants={CAROUSEL_ARROW_VARIANTS}
            initial={CAROUSEL_ARROW_VARIANTS.initial('right')}
            animate="animate"
            whileHover="hover"
            whileTap="tap"
            transition={CAROUSEL_ARROW_VARIANTS.transition}
          >
            <motion.div
              variants={CAROUSEL_ARROW_ICON_VARIANTS}
              whileHover={CAROUSEL_ARROW_ICON_VARIANTS.hover('right')}
              transition={CAROUSEL_ARROW_ICON_VARIANTS.transition}
            >
              <ChevronRight className="size-5 sm:size-6" strokeWidth={2.5} />
            </motion.div>
          </motion.button>
        </>
      )}
    </div>
  )
}
