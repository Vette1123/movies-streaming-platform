/** The site's static card, for any page with no artwork of its own. */
export const DEFAULT_SHARE_IMAGE = '/opengraph-image.png'

/**
 * The image a Worker-built page unfurls with. An empty directory or a profile
 * with no posters has nothing to compose, and a page with no og:image unfurls
 * as a bare line of text.
 */
export const shareImageOf = (image: string | null | undefined, page: string) =>
  image || new URL(DEFAULT_SHARE_IMAGE, page).href
