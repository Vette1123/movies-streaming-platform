/**
 * The query a detail fetch carries: its `append_to_response` list, plus the
 * image language that list needs.
 *
 * One TMDB request per detail page is the whole free-plan strategy — the 50
 * subrequests per Worker invocation and the 10ms CPU budget both come back to
 * this list — so it is defined once rather than typed out in two service files
 * that then drift.
 *
 * `watch/providers` used to ride along at build time, for a crawlable "where to
 * watch" block. Reely streams the title itself, so sending somebody to another
 * service was the wrong thing to render — the block is gone, and with it the
 * 10-20KB country list TMDB answers that append with.
 *
 * `images` is there for the title's official wordmark, which the detail hero
 * shows in place of the plain title exactly as the homepage hero does. It
 * rides on this same request rather than a second one (or a client call to
 * /api/hero-extras, which would be a Worker invocation per view).
 * `include_image_language=en` keeps it to the English artwork: measured at
 * +13-28KB raw against +28-49KB for `en,null`, and the language-neutral
 * logos are the ones without the title written on them anyway. Only the
 * picked path leaves the service — the block itself is peeled off before
 * anything is serialised (see populateMovieDetailsPage).
 */
const BASE_APPEND = [
  'credits',
  'similar',
  'recommendations',
  'videos',
  'images',
]

export const detailQuery = (extra: string[] = []): string =>
  `append_to_response=${[...BASE_APPEND, ...extra].join(',')}&include_image_language=en`
