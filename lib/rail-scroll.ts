/**
 * The arithmetic behind a horizontal rail's arrows.
 *
 * Pulled out of components/list.tsx because it is the part that can be wrong
 * silently. An arrow is enabled by comparing three numbers, and all three
 * change without a scroll and without the window moving: `scrollWidth` grows as
 * card images decode and as the Suspense skeleton swaps for the real row, and
 * `clientWidth` changes whenever the rail's box does — including the moment a
 * `content-visibility: auto` row below the fold first renders, where both go
 * from 0 to real in one frame with no event of their own.
 *
 * Get the comparison wrong and the failure is an arrow that is present, lit,
 * and does nothing: PostHog logged those as dead clicks. The rail itself is
 * verified in a browser; these numbers are verified here, because a rail that
 * has not been scrolled into view reports 0 for all three and every predicate
 * looks correct against it.
 */

export interface RailMetrics {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}

/**
 * 1px of slack, on purpose. Sub-pixel layout means a rail scrolled fully to one
 * end routinely reports a fraction rather than an exact extreme, and treating
 * 0.4px of remaining travel as "there is more" is what lights an arrow that
 * then scrolls nothing.
 */
const SLACK = 1

/** Travel left in `direction` (1 = right/forward, -1 = left/back). */
export function roomInDirection(
  direction: 1 | -1,
  { scrollLeft, scrollWidth, clientWidth }: RailMetrics
): number {
  const room =
    direction === 1 ? scrollWidth - clientWidth - scrollLeft : scrollLeft
  // A rail that has never been laid out reports 0 for everything, which makes
  // the forward sum negative. Callers ask "is there room", so never answer with
  // less than none.
  return Math.max(0, room)
}

/** Which arrows have somewhere to go. */
export function railArrowState(metrics: RailMetrics): {
  canLeft: boolean
  canRight: boolean
} {
  return {
    canLeft: roomInDirection(-1, metrics) > SLACK,
    canRight: roomInDirection(1, metrics) > SLACK,
  }
}

/** Whether pressing an arrow would actually move the track. */
export function canPage(direction: 1 | -1, metrics: RailMetrics): boolean {
  return roomInDirection(direction, metrics) > SLACK
}
