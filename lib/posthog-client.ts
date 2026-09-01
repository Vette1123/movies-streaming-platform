// Lazy access to the posthog-js singleton.
//
// posthog-js is 221KB raw / 73KB brotli — the single largest chunk in the app,
// bigger than react-dom. A static `import posthog from 'posthog-js'` anywhere in
// the client tree puts all of it in the initial script graph, so every cold page
// load downloaded and PARSED it before hydration finished. Deferring
// posthog.init() to requestIdleCallback (see providers/posthog-provider.tsx)
// solved the init cost but not the parse cost — the bytes were already there.
//
// So the module itself is imported dynamically. Nothing PostHog-related sits on
// the critical path; the chunk is fetched when the provider's idle/first-gesture
// scheduler asks for it, exactly when init was already going to run.
//
// Call sites use `ph()` and never touch posthog-js directly — importing it
// statically from anywhere would pull the chunk back into the initial graph and
// silently undo this. `import type` is fine (erased at build).

import type { PostHog } from 'posthog-js'

// Hosts that are never a real visitor: the dev server, `pnpm preview`'s wrangler
// runtime, and a phone testing over the LAN. Covers loopback, `.local` mDNS and
// the three RFC1918 private ranges.
const LOCAL_HOST =
  /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

// The scraper fleet's window, exactly. Headless Chrome opens 1280x720 with no
// browser chrome, and the fleet never resizes it — measured over 30 days, this
// one viewport accounted for 89,555 of 100,531 sessions and 99,459 of 124,166
// pageviews. A real window at this INNER size is possible but vanishingly rare:
// a 1280x720 display gives an inner height nearer 600 once the tab strip and
// address bar are taken out.
//
// Update these numbers if the fleet moves; they are a fingerprint, not a rule.
const HEADLESS_VIEWPORT = { width: 1280, height: 720 }

/**
 * Automated traffic, which is most of what reaches this site.
 *
 * 89% of sessions are one residential-proxy scraper fleet: 1.11 pageviews each,
 * a rotating UA (Chrome/Edge/Firefox on Windows/Mac, always en-US), and no
 * interaction at all. Over 30 days that cohort produced 28 $autocapture events,
 * 15 searches and 8 plays, against 22,935 / 5,325 / 7,099 from the ~11k real
 * sessions beside it.
 *
 * It was 63% of everything ingested — and it does not merely add volume, it
 * OWNS the aggregates: 39,867 of 58,280 $web_vitals samples came from it, with
 * a null LCP (it never paints one) and an FCP of 5.2s, which is why desktop
 * vitals read as failing while the same page is green for every human on it.
 * 84,480 of 85,026 image_host_fallback events are the same fleet failing to
 * fetch images, i.e. an alarm for an ImageKit outage that is not happening.
 *
 * Dropped at the gate rather than filtered in PostHog: the events are never
 * sent, so they cost no ingestion, create no person profile ($set was 108,357
 * events, 84% of them this), and cannot be forgotten by a dashboard that omits
 * the filter. Cloudflare already counts this traffic properly — see
 * `pnpm cf:health`; PostHog is meant to answer questions about people.
 */
const isAutomated = (): boolean => {
  try {
    // Set by every CDP-driven browser (Puppeteer, Playwright, Selenium) unless
    // it has been deliberately patched out. Free, and catches the honest ones.
    if (navigator.webdriver) return true
    return (
      window.innerWidth === HEADLESS_VIEWPORT.width &&
      window.innerHeight === HEADLESS_VIEWPORT.height
    )
  } catch {
    return false
  }
}

/**
 * Analytics is production-only AND human-only, and this is the one place that
 * decides both.
 *
 * Every dev session was reporting into the same project as real users: an HMR
 * `ReferenceError` ("useMemo is not defined"), a Turbopack stale-module failure,
 * a 404 fired while poking at an API by hand. On 2026-08-03 **all 20** open
 * Error Tracking issues were `http://localhost:3000` — they buried the real
 * ones completely, and the two genuine signals in the project were both
 * third-party browser noise.
 *
 * The gate lives in this module because it is the single gateway both the
 * provider and every `ph()` call site already go through, so a new call site
 * cannot leak dev data by omission. Two independent checks, either of which is
 * sufficient: NODE_ENV catches `pnpm dev`, the hostname catches a production
 * bundle served locally (`pnpm preview` on :8787, a LAN IP on a phone) where
 * NODE_ENV is legitimately "production".
 *
 * It is also where automated traffic stops — see isAutomated above. Same
 * reason, same place: a bot session is no more a visitor than a dev server is,
 * and this is the only door either of them can come through.
 */
export const analyticsEnabled = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) &&
  process.env.NODE_ENV === 'production' &&
  !LOCAL_HOST.test(window.location.hostname) &&
  !window.location.hostname.endsWith('.local') &&
  !isAutomated()

let instance: PostHog | null = null
let loading: Promise<PostHog | null> | null = null
const queued: ((posthog: PostHog) => void)[] = []

/**
 * Fetch and cache the posthog-js module, then replay anything `ph()` queued
 * while it was still absent. Idempotent and concurrency-safe — every caller
 * awaits the same import promise.
 *
 * Only two things call this: the provider's idle/gesture scheduler (the normal
 * path) and the error boundaries, which need the module NOW because the page may
 * be about to be reloaded or abandoned. Everything else queues via `ph()` and
 * rides along when one of those resolves.
 *
 * Resolves to `null` where analytics is off (see analyticsEnabled) — the error
 * boundaries call this directly, so returning null rather than rejecting keeps a
 * disabled build from turning every boundary report into an unhandled rejection,
 * which would be a new error event of its own.
 */
export function loadPostHog(): Promise<PostHog | null> {
  if (instance) return Promise.resolve(instance)
  if (!analyticsEnabled()) return Promise.resolve(null)
  loading ??= import('posthog-js').then((mod) => {
    instance = mod.default
    for (const fn of queued.splice(0)) fn(instance)
    return instance
  })
  return loading
}

/**
 * Run `fn` against the posthog singleton. Synchronous once loaded; before that
 * the call is queued and replays in order when the module arrives — so events
 * fired during the pre-load window are never lost, the same guarantee
 * posthog-js's own pre-init queue gives.
 *
 * Deliberately does NOT trigger the import: a capture on mount would otherwise
 * pull the chunk during hydration and put us right back where we started. Only
 * loadPostHog() starts the fetch.
 */
export function ph(fn: (posthog: PostHog) => void): void {
  if (instance) {
    fn(instance)
    return
  }
  // Drop instead of queue where analytics is off: nothing will ever flush the
  // queue, so every capture in a dev session would accumulate in it for the
  // lifetime of the tab.
  if (!analyticsEnabled()) return
  queued.push(fn)
}
