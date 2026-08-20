/**
 * The `append_to_response` list a detail fetch carries.
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
 */
const BASE_APPEND = ['credits', 'similar', 'recommendations', 'videos']

export const detailAppend = (extra: string[] = []): string =>
  [...BASE_APPEND, ...extra].join(',')
