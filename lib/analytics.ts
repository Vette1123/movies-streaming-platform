// Centralized, typed PostHog event layer.
//
// All custom product events flow through the helpers below so event names and
// property shapes stay consistent across the app. Reaches the posthog-js
// singleton through the lazy `ph()` accessor (see lib/posthog-client) rather
// than importing posthog-js directly — a static import here would drag the
// 221KB module back onto the critical path — so it works from any client
// component or hook without needing the React context.

import {
  claim,
  isClaimed,
  milestonesFor,
  noteActivity,
  routeTemplate,
  visitTraits,
} from '@/lib/analytics-context'
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
  NOT_INTERESTED: 'not_interested',
  NOT_INTERESTED_UNDONE: 'not_interested_undone',
  FILTER_PRESET_SAVED: 'filter_preset_saved',
  FILTER_PRESET_APPLIED: 'filter_preset_applied',
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
  PWA_PROMPTED: 'pwa_prompted',
  PLAYER_STREAM_PATH: 'player_stream_path',
  PLAYER_FAILED: 'player_failed',
  // Support / monetisation. One event with a `surface` property rather than an
  // event per placement: the only question worth asking of it is which surface
  // sends people to the plans, and that is a breakdown, not six funnels.
  SUPPORT_CTA_CLICKED: 'support_cta_clicked',
  SUPPORT_NUDGE_SHOWN: 'support_nudge_shown',
  NEWSLETTER_SUBSCRIBED: 'newsletter_subscribed',
  // The rest of the funnel. Until these existed nothing past /support was
  // measured at all: 33 people reached the plans in 38 days and whether any of
  // them left for checkout, signed in, or paid was unknowable from here.
  CHECKOUT_STARTED: 'checkout_started',
  SUPPORTER_GATE_SHOWN: 'supporter_gate_shown',
  SIGNED_IN: 'signed_in',
  SUPPORTER_ACTIVATED: 'supporter_activated',
  INVITE_SHARED: 'invite_shared',
  PLAYER_TRIAL_STARTED: 'player_trial_started',
  // Infrastructure
  IMAGE_HOST_FALLBACK: 'image_host_fallback',
  // Once-ever milestones, derived inside track() (lib/analytics-context.ts) —
  // never fired by a call site.
  FIRST_PLAY: 'first_play',
  FIRST_CORE_USE: 'first_core_use',
  // Coverage for everything else. Consolidated the way masareef does it: one
  // event per KIND of action with an enum property, rather than an event name
  // per button, so a new control is a new literal and not a new dashboard.
  PREF_CHANGED: 'pref_changed',
  SHARED: 'shared',
  RETRY_CLICKED: 'retry_clicked',
  SIGNED_OUT: 'signed_out',
  ACCOUNT_DELETED: 'account_deleted',
  RATING_SAVED: 'rating_saved',
  RATING_REMOVED: 'rating_removed',
  EPISODE_TOGGLED: 'episode_toggled',
  STREAM_SOURCE_SELECTED: 'stream_source_selected',
  PLAYBACK_FINISHED: 'playback_finished',
  FEATURE_USED: 'feature_used',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]

/**
 * The part of the product an event belongs to, stamped on every event as
 * `area` (masareef's convention). It is what `pnpm posthog:usage` reports reach
 * by, and what a dashboard breaks down on, so "is anybody using lists" is one
 * filter instead of a remembered list of event names.
 */
export type EventArea =
  | 'playback'
  | 'detail'
  | 'browse'
  | 'search'
  | 'home'
  | 'library'
  | 'sharing'
  | 'account'
  | 'support'
  | 'pwa'
  | 'health'
  | 'activation'
  | 'social'
  | 'discover'
  | 'onboarding'
  | 'growth'

// `satisfies` makes a new event without an area a compile error.
export const EVENT_AREA = {
  media_played: 'playback',
  media_detail_viewed: 'detail',
  media_card_clicked: 'browse',
  load_more: 'browse',
  filter_changed: 'browse',
  filters_cleared: 'browse',
  search_opened: 'search',
  search_performed: 'search',
  search_no_results: 'search',
  search_result_clicked: 'search',
  command_shortcut_used: 'search',
  hero_watch_clicked: 'home',
  trailer_played: 'detail',
  hero_autoplay_toggled: 'home',
  media_shared: 'sharing',
  watchlist_added: 'library',
  watchlist_removed: 'library',
  not_interested: 'library',
  not_interested_undone: 'library',
  filter_preset_saved: 'browse',
  filter_preset_applied: 'browse',
  page_not_found: 'health',
  api_error: 'health',
  season_selected: 'detail',
  watch_history_added: 'library',
  watch_history_updated: 'library',
  watch_history_item_clicked: 'library',
  watch_history_item_removed: 'library',
  watch_history_cleared: 'library',
  pwa_installable: 'pwa',
  pwa_installed: 'pwa',
  pwa_prompted: 'pwa',
  player_stream_path: 'playback',
  player_failed: 'playback',
  support_cta_clicked: 'support',
  support_nudge_shown: 'support',
  newsletter_subscribed: 'support',
  checkout_started: 'support',
  supporter_gate_shown: 'support',
  signed_in: 'account',
  supporter_activated: 'support',
  invite_shared: 'sharing',
  player_trial_started: 'playback',
  image_host_fallback: 'health',
  first_play: 'activation',
  first_core_use: 'activation',
  pref_changed: 'account',
  shared: 'sharing',
  retry_clicked: 'health',
  signed_out: 'account',
  account_deleted: 'account',
  rating_saved: 'library',
  rating_removed: 'library',
  episode_toggled: 'library',
  stream_source_selected: 'playback',
  playback_finished: 'playback',
  // Overridden per feature by FEATURE_AREA (see trackFeatureUsed).
  feature_used: 'discover',
} as const satisfies Record<EventName, EventArea>

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

// Visit traits are registered once per page load and again whenever a new
// visit begins, not on every event: register() rewrites persistence each call.
let visitRegistered = false

/**
 * Advance the visit counter and, when it moved, re-register the visit super
 * properties so $autocapture / $exception / $web_vitals carry them too.
 */
function noteVisit(now: number) {
  const visit = noteActivity(now)
  if (visit.newVisit || !visitRegistered) {
    visitRegistered = true
    const traits = visitTraits(visit.record, now)
    ph((posthog) => posthog.register(traits))
  }
  return visit.record
}

/**
 * The one choke point every custom event passes. Typed to EVENTS so a typo is
 * a compile error, stamps `area`, advances the visit counter, and derives the
 * once-ever milestones (first_play, first_core_use) so no call site can forget
 * them.
 */
export function track(
  event: EventName,
  properties?: Record<string, unknown>
): void {
  if (!isClient()) return
  const now = Date.now()
  const record = noteVisit(now)
  const milestones = milestonesFor(event, record, now, isClaimed)
  for (const milestone of milestones) claim(milestone.key, now)
  // Read now, not from the `route` super property: that is registered by the
  // $pageview effect, which on a client navigation can run after the new
  // page's own effects, so their events carried the previous page's route.
  const pathname = window.location?.pathname
  const route = pathname ? { route: routeTemplate(pathname) } : {}
  ph((posthog) => {
    posthog.capture(event, { area: EVENT_AREA[event], ...route, ...properties })
    for (const milestone of milestones) {
      posthog.capture(milestone.key, {
        area: EVENT_AREA[milestone.key],
        ...route,
        ...milestone.properties,
      })
    }
  })
}

/** Super properties carried on every later event (e.g. the current server). */
export function registerAnalyticsContext(
  properties: Record<string, string | number | boolean | null>
): void {
  if (!isClient()) return
  ph((posthog) => posthog.register(properties))
}

/**
 * $pageview with the route template on it, registered as a super property as
 * well so every autocaptured click, rageclick and exception on the page can be
 * broken down by screen instead of by 2,000 distinct pathnames.
 */
export function trackPageview(url: string, pathname: string): void {
  if (!isClient()) return
  noteVisit(Date.now())
  const route = routeTemplate(pathname)
  ph((posthog) => {
    posthog.register({ route })
    posthog.capture('$pageview', { $current_url: url, route })
  })
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
  // 'web_share' = native OS share sheet; 'clipboard' = copy-link fallback;
  // 'card_share' = spoiler-free PNG through the sheet; 'card_download' = the
  // same PNG saved to disk (platform could not share files).
  method: 'web_share' | 'clipboard' | 'card_share' | 'card_download'
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

// ---- Not interested ---------------------------------------------------------

/**
 * Worth capturing precisely because it is the one signal here that says what
 * somebody does NOT want. If a title is hidden by a lot of people it is either
 * badly recommended or badly presented, and neither is visible in any other
 * event on this list.
 */
export function trackNotInterested(props: {
  media_id: number
  media_type: MediaKind
  title?: string
}): void {
  track(EVENTS.NOT_INTERESTED, props)
}

export function trackNotInterestedUndone(props: {
  media_id: number
  media_type: MediaKind
  title?: string
}): void {
  track(EVENTS.NOT_INTERESTED_UNDONE, props)
}

// ---- Saved filters ----------------------------------------------------------

export function trackFilterPresetSaved(props: { preset_count: number }): void {
  track(EVENTS.FILTER_PRESET_SAVED, props)
}

export function trackFilterPresetApplied(): void {
  track(EVENTS.FILTER_PRESET_APPLIED, {})
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

/** Subscribed to the weekly digest. `source` is where from — `footer`,
 * `support`, etc. */
export function trackNewsletterSubscribed(props: { source: string }): void {
  track(EVENTS.NEWSLETTER_SUBSCRIBED, props)
}

/**
 * Somebody left for the payment page. `plan` is the card they pressed, and
 * `signedIn` matters because a payment only lands on an account whose email
 * matches the one paid with - see components/support/checkout-guard.tsx.
 */
export function trackCheckoutStarted(props: {
  plan: 'monthly' | 'yearly' | 'lifetime' | 'any'
  signedIn: boolean
  surface: string
}): void {
  track(EVENTS.CHECKOUT_STARTED, props)
}

/** A locked supporter feature was put in front of somebody. */
export function trackSupporterGateShown(props: { feature: string }): void {
  track(EVENTS.SUPPORTER_GATE_SHOWN, props)
}

/** This browser went from signed out to signed in (once per browser). */
export function trackSignedIn(): void {
  track(EVENTS.SIGNED_IN, {})
}

/**
 * This browser saw its account become a supporter. The conversion itself:
 * payment happens on Buy Me a Coffee and lands through the webhook, so this is
 * the first point the site can see the money arrive.
 */
export function trackSupporterActivated(props: { surface: string }): void {
  track(EVENTS.SUPPORTER_ACTIVATED, props)
}

/** Today's free title on the Reely Player was started (lib/player-trial.ts). */
export function trackPlayerTrialStarted(props: { signedIn: boolean }): void {
  track(EVENTS.PLAYER_TRIAL_STARTED, props)
}

/** Somebody copied or shared their invite link. */
export function trackInviteShared(props: { method: 'copy' | 'share' }): void {
  track(EVENTS.INVITE_SHARED, props)
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
  track(EVENTS.API_ERROR, props)
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
        // One issue per failing flow and status (rafiq's `flow:code`). Every
        // one of these is built on the same line, so PostHog's stack-based
        // grouping folded them all into a single "Error".
        $exception_fingerprint: `api:${props.source}:${props.status ?? 'none'}`,
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

const PWA_INSTALLABLE_KEY = 'reely:pwa-installable'

/**
 * Browser reports the app is installable (`beforeinstallprompt` fired).
 *
 * Once per tab session: Chrome re-fires the event on every full page load, and
 * it used to be listened for twice as well, so PostHog counted ~5 per person
 * (2,126 events / 406 people over 14 days to 2026-10-09).
 */
export function trackPwaInstallable(): void {
  try {
    if (sessionStorage.getItem(PWA_INSTALLABLE_KEY)) return
    sessionStorage.setItem(PWA_INSTALLABLE_KEY, '1')
  } catch {
    // Storage blocked: count it rather than lose it.
  }
  track(EVENTS.PWA_INSTALLABLE)
}

/** App was installed to the home screen / desktop (`appinstalled` fired). */
export function trackPwaInstalled(): void {
  track(EVENTS.PWA_INSTALLED)
  // The person trait, so installers can be filtered on without an event join.
  ph((posthog) => posthog.setPersonProperties({ pwa_installed: true }))
}

/**
 * The native install dialog was shown, and what came back.
 *
 * Without this, "installable" and "installed" are the only two points on the
 * funnel and the gap between them has no explanation: nobody asked, or
 * everybody said no, look identical.
 */
export function trackPwaPrompted(props: {
  outcome: 'accepted' | 'dismissed'
}): void {
  track(EVENTS.PWA_PROMPTED, props)
}

/**
 * Which path carried this play: the viewer's own browser, or our relay.
 *
 * A media element sends no `Origin`, so a browser that can play HLS natively
 * fetches the film straight from the provider and costs us nothing; hls.js
 * must send one, and the CDN refuses it, so those plays come through the relay
 * and cost us the whole film. That split is the site's only per-viewer
 * expense, and it was previously reasoned about rather than counted.
 *
 * It is also the alarm for a change nobody here can test: Chromium has been
 * landing desktop native HLS since 142, and Android Chrome may already pass.
 * Either shows up as this ratio moving on its own.
 */
export function trackPlayerStreamPath(props: { native: boolean }): void {
  track(EVENTS.PLAYER_STREAM_PATH, props)
}

/**
 * A server did not play: the 9s stall (any embed) or the house player saying
 * its stream could not be resolved.
 *
 * Both were handled on screen and invisible here, so when `vidsrcme.ru` lapsed
 * on 2026-10-08 and every Reely Beta play went black, PostHog showed nothing at
 * all. `source` is the stable source id; break down by it to see which server
 * is down.
 */
export function trackPlayerFailed(props: {
  source: string
  reason: 'stall' | 'unavailable'
}): void {
  track(EVENTS.PLAYER_FAILED, props)
}

// ---- Infrastructure ---------------------------------------------------------

/**
 * The primary image CDN (wsrv.nl) failed and the session fell to TMDB's origin.
 *
 * Fired once per session, by the circuit breaker in lib/tmdbConfig.ts. The
 * fallback chain is silent by design — it keeps every image on screen — so
 * without this the way we find out wsrv is down is a user saying the site
 * looks wrong. Which is exactly how the ImageKit quota was found.
 */
export function trackImageHostFallback(): void {
  track(EVENTS.IMAGE_HOST_FALLBACK)
}

// ---- Coverage: the long tail -------------------------------------------------

/**
 * Every feature without an event of its own, and the area it reports under.
 * Adding a feature is one line here; `satisfies` keeps the areas closed.
 */
export const FEATURE_AREA = {
  match_night: 'social',
  watch_together: 'social',
  compare: 'social',
  public_profile: 'social',
  lists: 'library',
  calendar: 'library',
  stats: 'library',
  watchlist_transfer: 'library',
  hidden_titles: 'library',
  mood: 'discover',
  reels: 'discover',
  tonight_triple: 'discover',
  for_you: 'discover',
  taste_picker: 'onboarding',
  gifts: 'support',
  library_import: 'account',
  data_export: 'account',
  library_sync: 'account',
  tv_link: 'account',
  push_alerts: 'account',
  rescue_banner: 'account',
  pwa_nudge: 'pwa',
  store_link: 'growth',
  promo_shown: 'growth',
  promo_click: 'growth',
  recent_searches: 'search',
} as const satisfies Record<string, EventArea>

export type Feature = keyof typeof FEATURE_AREA

type Scalar = string | number | boolean | null | undefined

/**
 * A feature was used. `action` is a short literal at the call site ('created',
 * 'joined', 'copied', …) and `outcome` says whether it worked. Counts, ids and
 * enums only — never user text.
 */
export function trackFeatureUsed(props: {
  feature: Feature
  action: string
  outcome?: 'ok' | 'failed' | 'denied' | 'empty'
  [extra: string]: Scalar
}): void {
  track(EVENTS.FEATURE_USED, { area: FEATURE_AREA[props.feature], ...props })
}

/** One pref changed, through the account's single save path. */
export function trackPrefChanged(props: {
  key: string
  value: string | number | boolean | null
}): void {
  track(EVENTS.PREF_CHANGED, props)
}

/** Anything shared that is not a title card (media_shared covers those). */
export function trackShared(props: {
  surface: string
  method: 'web_share' | 'clipboard' | 'download' | 'dismissed'
}): void {
  track(EVENTS.SHARED, props)
}

/** A "Try again" was pressed: how often each surface fails in front of someone. */
export function trackRetryClicked(props: {
  surface: string
  [extra: string]: Scalar
}): void {
  track(EVENTS.RETRY_CLICKED, props)
}

export function trackSignedOut(props: { all: boolean; surface: string }): void {
  track(EVENTS.SIGNED_OUT, props)
}

export function trackAccountDeleted(props: { ok: boolean }): void {
  track(EVENTS.ACCOUNT_DELETED, props)
}

export function trackRatingSaved(props: {
  media_id: number
  media_type: MediaKind
  score: number
  has_note: boolean
}): void {
  track(EVENTS.RATING_SAVED, props)
}

export function trackRatingRemoved(props: {
  media_id: number
  media_type: MediaKind
}): void {
  track(EVENTS.RATING_REMOVED, props)
}

/** An episode ticked or unticked by hand on the episode list. */
export function trackEpisodeToggled(props: {
  media_id: number
  season: number
  episode: number
  completed: boolean
}): void {
  track(EVENTS.EPISODE_TOGGLED, props)
}

/** A server picked by the viewer, or by the automatic hop after a stall. */
export function trackStreamSourceSelected(props: {
  source: string
  via: 'switcher' | 'stall_auto'
}): void {
  track(EVENTS.STREAM_SOURCE_SELECTED, props)
}

/** The player reported the end of the title. */
export function trackPlaybackFinished(props: {
  media_id: number
  media_type: MediaKind
  source?: string
}): void {
  track(EVENTS.PLAYBACK_FINISHED, props)
}
