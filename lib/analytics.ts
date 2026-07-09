// Centralized, typed PostHog event layer.
//
// All custom product events flow through the helpers below so event names and
// property shapes stay consistent across the app. Uses the posthog-js singleton
// (initialized in providers/posthog-provider.tsx) so it works from any client
// component or hook without needing the React context.

import posthog from 'posthog-js'

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
  MEDIA_SHARED: 'media_shared',
  // Watchlist (save for later — distinct from watch history)
  WATCHLIST_ADDED: 'watchlist_added',
  WATCHLIST_REMOVED: 'watchlist_removed',
  // Navigation health
  PAGE_NOT_FOUND: 'page_not_found',
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
} as const

export type MediaKind = 'movie' | 'tv'

const isClient = () => typeof window !== 'undefined'

/** Thin wrapper so every call is guarded and centrally typed. */
export function track(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!isClient()) return
  posthog.capture(event, properties)
}

// ---- Playback ---------------------------------------------------------------

export function trackMediaPlayed(props: {
  media_id: number
  media_type: MediaKind
  title?: string
  season?: number
  episode?: number
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

// ---- Navigation health ------------------------------------------------------

export function trackPageNotFound(props: { path?: string }): void {
  track(EVENTS.PAGE_NOT_FOUND, props)
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
