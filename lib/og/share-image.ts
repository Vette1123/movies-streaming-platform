/** The site's static card, for any page with no artwork of its own. */
export const DEFAULT_SHARE_IMAGE = '/opengraph-image.png'

/**
 * Describes the card for screen readers and for search, so it follows the
 * launch-kit copy rule like the card itself: the catalogue and the tracking,
 * never "free movies" or a streaming pitch.
 */
export const SITE_CARD_ALT =
  'Reely, the open-source movie and TV tracker: find what to watch, then keep track.'

/**
 * The card with its size and alt, so every unfurl gets og:image:width/height
 * (scrapers that see them render the large preview on the first share
 * instead of fetching the image to measure it) and og:image:alt.
 */
export const SITE_CARD = {
  url: DEFAULT_SHARE_IMAGE,
  width: 1200,
  height: 630,
  alt: SITE_CARD_ALT,
  type: 'image/png',
}

/**
 * The image a Worker-built page unfurls with. An empty directory or a profile
 * with no posters has nothing to compose, and a page with no og:image unfurls
 * as a bare line of text.
 */
export const shareImageOf = (image: string | null | undefined, page: string) =>
  image || new URL(DEFAULT_SHARE_IMAGE, page).href
