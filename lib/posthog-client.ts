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

/**
 * Analytics is PRODUCTION-ONLY, and this is the one place that decides it.
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
 */
export const analyticsEnabled = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) &&
  process.env.NODE_ENV === 'production' &&
  !LOCAL_HOST.test(window.location.hostname) &&
  !window.location.hostname.endsWith('.local')

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
