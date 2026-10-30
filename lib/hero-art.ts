/**
 * Whether a hero slide may render its artwork yet.
 *
 * The carousel keeps a slide mounted either side, parked one stage-width away,
 * and that is inside the browser's lazy-load margin: `loading="lazy"` fetched
 * both anyway, at high priority, 281 of the 776 KB a phone downloads on first
 * load, racing the one picture it can see. So a neighbour renders no <img> until
 * it is on stage or the page has finished loading.
 */
export const heroArtReady = ({
  priority,
  active,
  warm,
}: {
  priority: boolean
  active: boolean
  warm: boolean
}) => priority || active || warm
