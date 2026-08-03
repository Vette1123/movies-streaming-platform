import type {
  HTMLMotionProps,
  TargetAndTransition,
  Transition,
  Variants,
} from 'framer-motion'

type CubicBezier = readonly [number, number, number, number]

const EASE_OUT_CUBIC: CubicBezier = [0.25, 0.46, 0.45, 0.94] as const

// Only what something actually renders lives here. This file used to export 24
// variant bundles, 17 of which no components referenced at all — leftovers from
// carousel versions that were replaced (the crossfade stack, the per-slide
// scale/rotateY/blur transitions, the drag constraints). Dead variants are not
// free: they are module-scope objects in a chunk that ships to every visitor.

const CARD_VARIANT: Variants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.03,
    y: -6,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 22,
      mass: 0.6,
    },
  },
}

const CAROUSEL_SINGLE_SLIDE_VARIANTS: HTMLMotionProps<'div'> = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: {
    duration: 0.6,
    ease: EASE_OUT_CUBIC,
  },
}

interface CarouselNavigationBundle {
  initial: TargetAndTransition
  animate: (isMounted: boolean) => TargetAndTransition
  transition: Transition
}

const CAROUSEL_NAVIGATION_VARIANTS: CarouselNavigationBundle = {
  initial: { opacity: 0, y: 20 },
  animate: (isMounted) => ({
    opacity: isMounted ? 1 : 0,
    y: 0,
  }),
  transition: { duration: 0.5, delay: 0.3 },
}

interface CarouselArrowBundle {
  initial: (direction: 'left' | 'right') => TargetAndTransition
  animate: TargetAndTransition
  hover: TargetAndTransition
  tap: TargetAndTransition
  transition: Transition
}

const CAROUSEL_ARROW_VARIANTS: CarouselArrowBundle = {
  initial: (direction) => ({
    x: direction === 'left' ? -20 : 20,
    scale: 0.8,
    opacity: 0,
  }),
  animate: {
    x: 0,
    scale: 1,
    opacity: 1,
  },
  hover: {
    scale: 1.05,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    transition: {
      duration: 0.2,
      ease: EASE_OUT_CUBIC,
    },
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
  transition: {
    duration: 0.6,
    delay: 0.2,
    ease: EASE_OUT_CUBIC,
  },
}

interface CarouselArrowIconBundle {
  hover: (direction: 'left' | 'right') => TargetAndTransition
  transition: Transition
}

const CAROUSEL_ARROW_ICON_VARIANTS: CarouselArrowIconBundle = {
  hover: (direction) => ({
    x: direction === 'left' ? -2 : 2,
    scale: 1.05,
  }),
  transition: {
    type: 'spring',
    stiffness: 500,
    damping: 25,
    mass: 0.5,
  },
}

const CAROUSEL_POSITION_INDICATOR_VARIANTS: HTMLMotionProps<'div'> = {
  layout: true,
  transition: { type: 'spring', stiffness: 400, damping: 25 },
}

const CAROUSEL_POSITION_TEXT_VARIANTS: HTMLMotionProps<'span'> = {
  initial: { scale: 0.9, opacity: 0.8 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.2 },
}

export {
  CARD_VARIANT,
  CAROUSEL_SINGLE_SLIDE_VARIANTS,
  CAROUSEL_NAVIGATION_VARIANTS,
  CAROUSEL_ARROW_VARIANTS,
  CAROUSEL_ARROW_ICON_VARIANTS,
  CAROUSEL_POSITION_INDICATOR_VARIANTS,
  CAROUSEL_POSITION_TEXT_VARIANTS,
}
