const HIDDEN_TEXT_VARIANT = {
  rest: { opacity: 0, display: 'none', ease: 'easeOut', duration: 0.2, x: -50 },
  hover: {
    opacity: 1,
    display: 'block',
    x: 0,
    transition: {
      duration: 0.8,
      ease: 'easeIn',
      type: 'spring',
    },
  },
}
const HIDDEN_TEXT_ARROW_VARIANT = {
  rest: { opacity: 0, display: 'none', ease: 'easeOut', x: 50 },
  hover: {
    opacity: 1,
    display: 'block',
    x: 0,
    transition: {
      ease: 'easeIn',
      type: 'spring',
    },
  },
}
const CHANGE_COLOR_VARIANT = {
  rest: { color: '#fff', ease: 'easeOut' },
  hover: {
    color: '#a5f3fc',
    transition: {
      ease: 'easeIn',
      type: 'spring',
    },
  },
}

const CARD_VARIANT = {
  rest: { opacity: 0.8, scale: 1, y: 0 },
  hover: {
    opacity: 1,
    scale: 1.1,
    y: -10,
    transition: {
      duration: 0.8,
      ease: 'easeIn',
      type: 'spring',
    },
  },
}

// Carousel Motion Variants
const CAROUSEL_SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.95,
    rotateY: direction * 3,
    filter: 'blur(4px)',
    transformOrigin: direction > 0 ? 'left center' : 'right center',
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0,
    filter: 'blur(0px)',
    transformOrigin: 'center center',
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.95,
    rotateY: direction * -3,
    filter: 'blur(4px)',
    transformOrigin: direction < 0 ? 'left center' : 'right center',
  }),
}

const CAROUSEL_BACKGROUND_VARIANTS = {
  enter: {
    opacity: 0.2,
    scale: 1.1,
    filter: 'blur(20px) brightness(0.4)',
  },
  center: {
    opacity: 0.4,
    scale: 1.05,
    filter: 'blur(15px) brightness(0.3)',
  },
  exit: {
    opacity: 0,
    scale: 1,
    filter: 'blur(25px) brightness(0.2)',
  },
}

const CAROUSEL_PLACEHOLDER_VARIANTS = {
  initial: {
    opacity: 1,
    scale: 1.02,
    filter: 'blur(10px) brightness(0.6)',
  },
  loaded: {
    opacity: 0,
    scale: 1,
    filter: 'blur(0px) brightness(1)',
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

const CAROUSEL_SINGLE_SLIDE_VARIANTS = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: { 
    duration: 0.6, 
    ease: [0.25, 0.46, 0.45, 0.94] 
  },
}

const CAROUSEL_NAVIGATION_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: (isMounted: boolean) => ({ 
    opacity: isMounted ? 1 : 0, 
    y: 0 
  }),
  transition: { duration: 0.5, delay: 0.3 },
}

const CAROUSEL_DOT_VARIANTS = {
  initial: { opacity: 0, scale: 0 },
  animate: (isMounted: boolean) => ({ 
    opacity: isMounted ? 1 : 0, 
    scale: isMounted ? 1 : 0 
  }),
  hover: { scale: 1.2 },
  tap: { scale: 0.9 },
  transition: (index: number) => ({ 
    duration: 0.3, 
    delay: 0.4 + index * 0.05,
    type: 'spring',
    stiffness: 400,
    damping: 25
  }),
}

const CAROUSEL_ARROW_VARIANTS = {
  initial: (direction: 'left' | 'right') => ({ 
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
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  tap: { 
    scale: 0.98,
    transition: { duration: 0.1 }
  },
  transition: { 
    duration: 0.6, 
    delay: 0.2,
    ease: [0.25, 0.46, 0.45, 0.94]
  },
}

const CAROUSEL_ARROW_ICON_VARIANTS = {
  hover: (direction: 'left' | 'right') => ({ 
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

const CAROUSEL_CONTENT_VARIANTS = {
  initial: { filter: 'brightness(0.9)' },
  animate: { filter: 'brightness(1)' },
  transition: { duration: 0.3, delay: 0.1 },
}

const CAROUSEL_POSITION_INDICATOR_VARIANTS = {
  layout: true,
  transition: { type: 'spring', stiffness: 400, damping: 25 },
}

const CAROUSEL_POSITION_TEXT_VARIANTS = {
  initial: { scale: 0.9, opacity: 0.8 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.2 },
}

const CAROUSEL_ELLIPSIS_VARIANTS = {
  initial: { opacity: 0 },
  animate: (isMounted: boolean) => ({ opacity: isMounted ? 1 : 0 }),
  transition: { duration: 0.3 },
}

// Carousel Transition Configurations
const CAROUSEL_SLIDE_TRANSITION = (isDragging: boolean) => ({
  x: {
    type: 'spring' as const,
    stiffness: isDragging ? 600 : 300,
    damping: isDragging ? 35 : 30,
    mass: isDragging ? 0.3 : 0.8,
  },
  opacity: {
    duration: isDragging ? 0.15 : 0.4,
    ease: [0.25, 0.46, 0.45, 0.94],
  },
  scale: {
    duration: isDragging ? 0.15 : 0.5,
    ease: [0.25, 0.46, 0.45, 0.94],
  },
  rotateY: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 25,
    mass: 0.5,
  },
  filter: {
    duration: isDragging ? 0.1 : 0.3,
    ease: [0.25, 0.46, 0.45, 0.94],
  },
})

const CAROUSEL_BACKGROUND_TRANSITION = {
  duration: 1.2,
  ease: [0.25, 0.46, 0.45, 0.94],
}

const CAROUSEL_DRAG_CONSTRAINTS = { left: 0, right: 0 }

const CAROUSEL_DRAG_TRANSITION = {
  bounceStiffness: 800,
  bounceDamping: 40,
  power: 0.3,
  timeConstant: 500,
}

const CAROUSEL_WHILE_DRAG = (direction: number) => ({
  scale: 0.96,
  rotateY: direction * 2,
  cursor: 'grabbing',
  filter: 'blur(1px)',
  transition: {
    duration: 0.1,
    ease: 'easeOut',
  },
})

const CAROUSEL_WHILE_HOVER = {
  scale: 1.005,
  transition: { 
    duration: 0.3,
    ease: [0.25, 0.46, 0.45, 0.94]
  },
}

const CAROUSEL_WHILE_TAP = {
  scale: 0.995,
  transition: { duration: 0.1 },
}

export {
  HIDDEN_TEXT_VARIANT,
  CHANGE_COLOR_VARIANT,
  HIDDEN_TEXT_ARROW_VARIANT,
  CARD_VARIANT,
  // Carousel variants
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
  // Carousel transitions
  CAROUSEL_SLIDE_TRANSITION,
  CAROUSEL_BACKGROUND_TRANSITION,
  CAROUSEL_DRAG_CONSTRAINTS,
  CAROUSEL_DRAG_TRANSITION,
  CAROUSEL_WHILE_DRAG,
  CAROUSEL_WHILE_HOVER,
  CAROUSEL_WHILE_TAP,
}
