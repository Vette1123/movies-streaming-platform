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

let instance: PostHog | null = null
let loading: Promise<PostHog> | null = null
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
 */
export function loadPostHog(): Promise<PostHog> {
  if (instance) return Promise.resolve(instance)
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
  queued.push(fn)
}
