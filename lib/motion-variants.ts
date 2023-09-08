const HIDDEN_TEXT_VARIANT = {
  rest: { opacity: 0, ease: 'easeOut', duration: 0.2, x: -50 },
  hover: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.8,
      ease: 'easeIn',
      type: 'spring',
    },
  },
}
const HIDDEN_TEXT_ARROW_VARIANT = {
  rest: { opacity: 0, ease: 'easeOut', duration: 0.2, x: 50 },
  hover: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 1.2,
      ease: 'easeIn',
      type: 'spring',
    },
  },
}
const CHANGE_COLOR_VARIANT = {
  rest: { color: '#fff', ease: 'easeOut', duration: 0.2 },
  hover: {
    color: '#a5f3fc',
    transition: {
      duration: 0.4,
      ease: 'easeIn',
      type: 'spring',
    },
  },
}

export { HIDDEN_TEXT_VARIANT, CHANGE_COLOR_VARIANT, HIDDEN_TEXT_ARROW_VARIANT }
