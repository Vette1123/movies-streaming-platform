// How many neighbours to keep mounted on each side. A mounted neighbour has its
// image already decoded, so when it becomes active there is no network round-trip
// and no blur-in — the flash of the previous/blank slide disappears entirely.
const WINDOW = 1

// Neighbours wait for `neighboursReady`, which the server never has. Each hero
// slide is ~20KB of HTML ahead of the first-paint marker and its own hydration
// work, for a slide nobody can see until the page has settled or a finger lands.
export function isSlideMounted({
  active,
  distance,
  neighboursReady,
}: {
  active: boolean
  distance: number
  neighboursReady: boolean
}) {
  if (active) return true
  return neighboursReady ? Math.abs(distance) <= WINDOW : distance === 0
}
