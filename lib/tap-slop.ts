// How far a finger may travel and still count as a tap rather than a swipe.
// Comfortably under framer's own 3px drag threshold doubled — a deliberate
// swipe covers tens of pixels, a thumb pressing a button covers a handful.
export const TAP_SLOP = 12

type Point = { x: number; y: number }

/**
 * A click the browser fires at the end of a mouse SWIPE, which must not act.
 *
 * During a drag the carousel track follows the cursor, so a swipe that starts
 * on a link (Watch Now, the hero title) also ends on it, and the browser sends
 * that link a click. Anything that travelled past the slop was a swipe.
 * `detail === 0` is a click with no pointer behind it, from the keyboard or
 * from the carousel's own touch-tap handler: those always act.
 */
export function isSwipeClick(
  down: Point | null,
  click: Point & { detail: number }
): boolean {
  if (!down || click.detail === 0) return false
  return Math.hypot(click.x - down.x, click.y - down.y) > TAP_SLOP
}
