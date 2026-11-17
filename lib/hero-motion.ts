/**
 * The hero backdrop's slow zoom (keyframes `hero-kenburns`, 1.05 -> 1.16 over
 * 14 s). Every mounted slide carries it; only the active one runs it.
 *
 * Dropping the class off the inactive slides (the old rule) made a swipe jump
 * twice on release, 17 Nov: the arriving slide snapped from scale 1 to the
 * keyframe's 1.05, and the leaving one fell back to 1 while still sliding out
 * in view. Paused, an inactive slide holds its frame instead: an unvisited one
 * sits at 1.05 (fill `both`), a visited one where it stopped.
 *
 * A weak device gets no zoom anywhere.
 */
export function kenBurnsClass(active: boolean, lowPower: boolean): string {
  if (lowPower) return ''
  const base = 'animate-hero-kenburns motion-reduce:animate-none'
  if (active) return base
  return `${base} [animation-play-state:paused]`
}

/** Direction a decided card leaves in: right for like, left for pass. */
export type SwipeDirection = 1 | -1

/**
 * The thrown card's exit. A function of the direction so AnimatePresence can
 * hand the CURRENT direction to a card that has already been removed: reading
 * it from the card's own props used the previous decision's direction.
 */
export function cardExit(direction: SwipeDirection, reduceMotion: boolean) {
  if (reduceMotion) return { opacity: 0 }
  return {
    x: direction * 520,
    rotate: direction * 18,
    opacity: 0,
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
  }
}
