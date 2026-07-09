// Person-profile enrichment for PostHog.
//
// This app has no authentication, so we never call posthog.identify(). Instead,
// with `person_profiles: 'always'` (see providers/posthog-provider.tsx) every
// visitor already gets a profile keyed on their anonymous distinct_id. These
// helpers make that profile *rich*: setPersonProperties attaches durable traits
// to the person, and register()/register_once() attach super properties that
// ride along on every captured event.
//
// $set        — overwritten each time (current state).
// $set_once   — written only if not already present (first-touch attribution).

import posthog from 'posthog-js'

import type { WatchedItem } from '@/hooks/use-local-storage'

const isClient = () => typeof window !== 'undefined'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'

/** Coarse screen bucket so profiles segment cleanly without high cardinality. */
function screenCategory(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

/** True when the app is running as an installed PWA. */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function referrerDomain(): string | null {
  if (!document.referrer) return null
  try {
    return new URL(document.referrer).hostname
  } catch {
    return null
  }
}

/**
 * One-time-per-load enrichment: durable device / locale / environment traits
 * plus super properties carried on every subsequent event.
 */
export function enrichPersonProfile(): void {
  if (!isClient()) return

  const width = window.innerWidth
  const locale = navigator.language
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const prefersDark = window.matchMedia?.(
    '(prefers-color-scheme: dark)'
  ).matches
  const standalone = isStandalone()

  posthog.setPersonProperties(
    // $set — current state, refreshed every visit.
    {
      locale,
      timezone,
      prefers_dark_mode: prefersDark,
      screen_category: screenCategory(width),
      viewport_width: width,
      viewport_height: window.innerHeight,
      pwa_installed: standalone,
      app_version: APP_VERSION,
    },
    // $set_once — first-touch, never overwritten.
    {
      first_seen_at: new Date().toISOString(),
      initial_locale: locale,
      initial_timezone: timezone,
      initial_referrer_domain: referrerDomain(),
    }
  )

  // Super properties: attached to every event captured afterwards.
  posthog.register({
    app_version: APP_VERSION,
    locale,
    display_mode: standalone ? 'standalone' : 'browser',
  })
}

/**
 * Behavioral enrichment derived from the local watch history. Call whenever the
 * watched-items list changes so the person profile reflects real engagement.
 */
export function syncWatchStats(items: WatchedItem[]): void {
  if (!isClient()) return

  const movies = items.filter((i) => i.type === 'movie').length
  const series = items.filter((i) => i.type === 'series').length

  // Most recently touched item drives the "last watched" traits.
  const latest = items.reduce<WatchedItem | null>((newest, item) => {
    if (!newest) return item
    return item.modified_at > newest.modified_at ? item : newest
  }, null)

  posthog.setPersonProperties(
    {
      watch_history_count: items.length,
      movies_watched: movies,
      series_watched: series,
      has_watched: items.length > 0,
      last_watched_title: latest?.title ?? null,
      last_watched_type: latest?.type ?? null,
      last_watched_at: latest?.modified_at ?? null,
    },
    // First title ever added is first-touch.
    items.length > 0
      ? {
          first_watched_title: items[0]?.title,
          first_watched_at: items[0]?.added_at,
        }
      : undefined
  )
}
