// Centralized, typed PostHog event layer.
//
// All custom product events flow through the helpers below so event names and
// property shapes stay consistent across the app. Reaches the posthog-js
// singleton through the lazy `ph()` accessor (see lib/posthog-client) rather
// than importing posthog-js directly — a static import here would drag the
// 221KB module back onto the critical path — so it works from any client
// component or hook without needing the React context.

import {
  genreNames,
  getMediaReleaseDate,
  getMediaTitle,
  getReleaseYear,
} from '@/lib/media'
import { ph } from '@/lib/posthog-client'

export const EVENTS = {
  // Playback (primary conversion)
  MEDIA_PLAYED: 'media_played',
  // Detail pages
  MEDIA_DETAIL_VIEWED: 'media_detail_viewed',
  // Browse / discovery
  MEDIA_CARD_CLICKED: 'media_card_clicked',
  LOAD_MORE: 'load_more',
  FILTER_CHANGED: 'filter_changed',
  FILTERS_CLEARED: 'filters_cleared',
  // Search (command menu)
  SEARCH_OPENED: 'search_opened',
  SEARCH_PERFORMED: 'search_performed',
  SEARCH_NO_RESULTS: 'search_no_results',
  SEARCH_RESULT_CLICKED: 'search_result_clicked',
  COMMAND_SHORTCUT_USED: 'command_shortcut_used',
  // Hero / CTAs
  HERO_WATCH_CLICKED: 'hero_watch_clicked',
  TRAILER_PLAYED: 'trailer_played',
  HERO_AUTOPLAY_TOGGLED: 'hero_autoplay_toggled',
  MEDIA_SHARED: 'media_shared',
  // Watchlist (save for later — distinct from watch history)
  WATCHLIST_ADDED: 'watchlist_added',
  WATCHLIST_REMOVED: 'watchlist_removed',
  // Navigation health
  PAGE_NOT_FOUND: 'page_not_found',
  // Reliability — any caught API / data-fetch failure (server actions, TMDB,
  // react-query). Handled errors don't surface as unhandled $exceptions, so we
  // record them explicitly to catch regressions like a flaky episode list.
  API_ERROR: 'api_error',
  // Series navigation
  SEASON_SELECTED: 'season_selected',
  // Watch history
  WATCH_HISTORY_ADDED: 'watch_history_added',
  WATCH_HISTORY_UPDATED: 'watch_history_updated',
  WATCH_HISTORY_ITEM_CLICKED: 'watch_history_item_clicked',
  WATCH_HISTORY_ITEM_REMOVED: 'watch_history_item_removed',
  WATCH_HISTORY_CLEARED: 'watch_history_cleared',
  // PWA install lifecycle
  PWA_INSTALLABLE: 'pwa_installable',
  PWA_INSTALLED: 'pwa_installed',
  // Support / monetisation. One event with a `surface` property rather than an
  // event per placement: the only question worth asking of it is which surface
  // sends people to the plans, and that is a breakdown, not six funnels.
  SUPPORT_CTA_CLICKED: 'support_cta_clicked',
  SUPPORT_NUDGE_SHOWN: 'support_nudge_shown',
  // Infrastructure
  IMAGE_HOST_FALLBACK: 'image_host_fallback',
} as const

export type MediaKind = 'movie' | 'tv'

// Stored/domain items use `'movie' | 'series'`; analytics uses `'movie' | 'tv'`.
// One place maps between them so the mapping can't drift across call sites.
export const toAnalyticsMediaType = (type: 'movie' | 'series'): MediaKind =>
  type === 'movie' ? 'movie' : 'tv'

interface MediaEventMedia {
  id: number
  title?: string
  name?: string
  vote_average?: number
  release_date?: string
  first_air_date?: string
  genres?: { name: string }[]
}

// Shared shape for media_played / media_detail_viewed payloads so the property
// set (and its title/release_year/genres derivation) stays identical across
// every call site — PostHog dashboards depend on that consistency. Callers
// spread the result and add event-specific extras (season/episode).
export function buildMediaEventBase(media: MediaEventMedia, type: MediaKind) {
  return {
    media_id: media.id,
    media_type: type,
    title: getMediaTitle(media),
    vote_average: media.vote_average,
    release_year: getReleaseYear(getMediaReleaseDate(media)),
    genres: genreNames(media.genres),
  }
}

const isClient = () => typeof window !== 'undefined'

/** Thin wrapper so every call is guarded and centrally typed. */
export function track(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!isClient()) return
  ph((posthog) => posthog.capture(event, properties))
}

// ---- Playback ---------------------------------------------------------------

export function trackMediaPlayed(props: {
  media_id: number
  media_type: MediaKind
  title?: string
  season?: number
  episode?: number
  // Series only: the play came from continue-watching rather than a plain start.
  is_resume?: boolean
  vote_average?: number
  release_year?: number | null
  genres?: string[]
}): void {
  track(EVENTS.MEDIA_PLAYED, props)
}

// ---- Detail pages -----------------------------------------------------------

export function trackMediaDetailViewed(props: {
  media_id: number
  media_type: MediaKind
  title?: string
  vote_average?: number
  release_year?: number | null
  genres?: string[]
}): void {
  track(EVENTS.MEDIA_DETAIL_VIEWED, props)
}

// ---- Browse / discovery -----------------------------------------------------

export function trackMediaCardClicked(props: {
  media_id: number
  media_type: MediaKind
  title?: string
  source?: string
}): void {
  track(EVENTS.MEDIA_CARD_CLICKED, props)
}

export function trackLoadMore(props: {
  media_type: MediaKind
  page: number
}): void {
  track(EVENTS.LOAD_MORE, props)
}

export function trackFilterChanged(props: {
  media_type: MediaKind
  filter_type: string
  value?: unknown
}): void {
  track(EVENTS.FILTER_CHANGED, props)
}

export function trackFiltersCleared(props: { media_type: MediaKind }): void {
  track(EVENTS.FILTERS_CLEARED, props)
}

// ---- Search -----------------------------------------------------------------

export function trackSearchOpened(): void {
  track(EVENTS.SEARCH_OPENED)
}

export function trackSearchPerformed(props: {
  query: string
  results_count: number
}): void {
  track(EVENTS.SEARCH_PERFORMED, props)
}

export function trackSearchNoResults(props: { query: string }): void {
  track(EVENTS.SEARCH_NO_RESULTS, props)
}

export function trackSearchResultClicked(props: {
  query: string
  media_id: number
  media_type: MediaKind
  title?: string
  position: number
}): void {
  track(EVENTS.SEARCH_RESULT_CLICKED, props)
}

export function trackCommandShortcutUsed(props: { shortcut: string }): void {
  track(EVENTS.COMMAND_SHORTCUT_USED, props)
}

// ---- Hero / CTAs ------------------------------------------------------------

export function trackHeroWatchClicked(props: {
  media_id: number
  media_type: MediaKind
}): void {
  track(EVENTS.HERO_WATCH_CLICKED, props)
}

export function trackTrailerPlayed(props: {
  media_id: number
  media_type: MediaKind
  title?: string
}): void {
  track(EVENTS.TRAILER_PLAYED, props)
}

export function trackHeroAutoplayToggled(props: {
  // The state the user switched TO.
  enabled: boolean
  media_id: number
  media_type: MediaKind
}): void {
  track(EVENTS.HERO_AUTOPLAY_TOGGLED, props)
}

export function trackMediaShared(props: {
  media_id?: number
  media_type?: MediaKind
  title?: string
  // 'web_share' = native OS share sheet; 'clipboard' = copy-link fallback.
  method: 'web_share' | 'clipboard'
}): void {
  track(EVENTS.MEDIA_SHARED, props)
}

// ---- Watchlist --------------------------------------------------------------

export function trackWatchlistAdded(props: {
  media_id: number
  media_type: MediaKind
  title?: string
}): void {
  track(EVENTS.WATCHLIST_ADDED, props)
}

export function trackWatchlistRemoved(props: {
  media_id: number
  media_type: MediaKind
  title?: string
}): void {
  track(EVENTS.WATCHLIST_REMOVED, props)
}

// ---- Support / monetisation -------------------------------------------------

/**
 * A route to the plans was taken. `surface` is where from — `footer`,
 * `header`, `drawer`, `watchlist`, `watch_history`, `account`, `list`,
 * `command_menu`, `nudge` — so the placements can be compared and the ones that
 * convert nobody can be removed rather than multiplied.
 */
export function trackSupportCtaClicked(props: { surface: string }): void {
  track(EVENTS.SUPPORT_CTA_CLICKED, props)
}

/** The one-time earned nudge was actually shown to someone. */
export function trackSupportNudgeShown(props: { trigger: string }): void {
  track(EVENTS.SUPPORT_NUDGE_SHOWN, props)
}

// ---- Navigation health ------------------------------------------------------

export function trackPageNotFound(props: { path?: string }): void {
  track(EVENTS.PAGE_NOT_FOUND, props)
}

// ---- Reliability / error tracking -------------------------------------------

/**
 * Records a caught API / data-fetch failure. Fires two things:
 *   1. an `api_error` product event (for funnels, alerts, breakdowns), and
 *   2. a first-class `$exception` via captureException, so the failure lands in
 *      PostHog Error Tracking with the same route/device enrichment as
 *      unhandled errors (see providers/posthog-provider.tsx → before_send).
 * Handled errors never surface on their own, so without this a broken episode
 * list or a flaky TMDB call is invisible — which is exactly what bit us.
 *
 * Pass `expected: true` for failures with no code fault behind them (a dropped
 * connection, an offline tab, a bundle retired by a deploy — see
 * lib/client-errors.ts). Those still emit the product event, so the rate stays
 * measurable, but skip step 2: filed as exceptions they outnumbered the real
 * regressions and buried them.
 */
export function trackApiError(props: {
  // Where it happened, e.g. 'season_episodes' or 'react_query'.
  source: string
  message: string
  status?: number
  media_id?: number
  media_type?: MediaKind
  season?: number
  url?: string
  query_key?: string
  expected?: boolean
}): void {
  if (!isClient()) return
  ph((posthog) => posthog.capture(EVENTS.API_ERROR, props))
  if (props.expected) return
  // Built HERE, not inside the callback below. An Error captures its stack where
  // it is constructed, and `ph()` may not run its callback until posthog-js has
  // finished loading — which fingerprinted every one of these at
  // lib/posthog-client.ts, the queue that replayed it, instead of the call site
  // that actually failed.
  const error = new Error(`[${props.source}] ${props.message}`)
  ph((posthog) => {
    try {
      posthog.captureException(error, {
        $exception_source: 'api',
        ...props,
      })
    } catch {
      // captureException must never itself throw and mask the original failure.
    }
  })
}

// ---- Series navigation ------------------------------------------------------

export function trackSeasonSelected(props: {
  media_id: number
  season: number
}): void {
  track(EVENTS.SEASON_SELECTED, props)
}

// ---- Watch history ----------------------------------------------------------

export function trackWatchHistoryAdded(props: {
  media_id: number
  media_type: MediaKind
  title?: string
}): void {
  track(EVENTS.WATCH_HISTORY_ADDED, props)
}

export function trackWatchHistoryUpdated(props: {
  media_id: number
  media_type: MediaKind
  season?: number
  episode?: number
}): void {
  track(EVENTS.WATCH_HISTORY_UPDATED, props)
}

export function trackWatchHistoryItemClicked(props: {
  media_id: number
  media_type: MediaKind
  title?: string
}): void {
  track(EVENTS.WATCH_HISTORY_ITEM_CLICKED, props)
}

export function trackWatchHistoryItemRemoved(props: {
  media_id: number
  media_type: MediaKind
  title?: string
}): void {
  track(EVENTS.WATCH_HISTORY_ITEM_REMOVED, props)
}

export function trackWatchHistoryCleared(props: { item_count: number }): void {
  track(EVENTS.WATCH_HISTORY_CLEARED, props)
}

// ---- PWA install lifecycle --------------------------------------------------

/** Browser reports the app is installable (`beforeinstallprompt` fired). */
export function trackPwaInstallable(): void {
  track(EVENTS.PWA_INSTALLABLE)
}

/** App was installed to the home screen / desktop (`appinstalled` fired). */
export function trackPwaInstalled(): void {
  track(EVENTS.PWA_INSTALLED)
}

// ---- Infrastructure ---------------------------------------------------------

/**
 * The primary image CDN (ImageKit) failed and the session fell to wsrv.nl.
 *
 * Fired once per session, by the circuit breaker in lib/tmdbConfig.ts. The
 * fallback chain is silent by design — it keeps every image on screen — so
 * without this the way we find out the ImageKit quota ran out is a user saying
 * the site looks wrong. Which is exactly how it went last time.
 */
export function trackImageHostFallback(): void {
  track(EVENTS.IMAGE_HOST_FALLBACK)
}
