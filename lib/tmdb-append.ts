import { IS_PRERENDER } from '@/lib/fetch-client'

/**
 * The `append_to_response` list a detail fetch carries.
 *
 * One TMDB request per detail page is the whole free-plan strategy — the 50
 * subrequests per Worker invocation and the 10ms CPU budget both come back to
 * this list — so it is defined once rather than typed out in two service files
 * that then drift.
 *
 * `watch/providers` is appended only where React is actually rendering. The
 * build gets it (that is what makes the crawlable "where to watch" block free);
 * the production Worker does not, because it parses this same payload on
 * /api/media/* and TMDB answers watch/providers for every country it knows —
 * 10-20KB of JSON, on the one route whose CPU has already been an outage.
 */
const BASE_APPEND = ['credits', 'similar', 'recommendations', 'videos']

/** TMDB's key for the appended block is the endpoint path, slash and all. */
export const WATCH_PROVIDERS_KEY = 'watch/providers'

export const detailAppend = (extra: string[] = []): string =>
  [
    ...BASE_APPEND,
    ...extra,
    ...(IS_PRERENDER ? [WATCH_PROVIDERS_KEY] : []),
  ].join(',')
