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

export {
  HIDDEN_TEXT_VARIANT,
  CHANGE_COLOR_VARIANT,
  HIDDEN_TEXT_ARROW_VARIANT,
  CARD_VARIANT,
}
