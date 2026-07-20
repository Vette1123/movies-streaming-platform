// Server-side PostHog exception capture — runtime-agnostic.
//
// The official posthog-node client relies on background flushing (timers /
// process hooks) that doesn't work in the Cloudflare Workers runtime this app
// deploys to (OpenNext). So instead of a client + dependency, we POST a single
// `$exception` event straight to PostHog's capture API with `fetch`, which works
// in any runtime. Fully defensive: error reporting must NEVER throw and mask the
// original error, and must never block the request meaningfully.

const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

// PostHog stores the visitor's id in a cookie named `ph_<key>_posthog` (JSON
// blob). Parse it best-effort so a server error is attributed to the SAME person
// as their client-side events; fall back to a stable anonymous id otherwise.
function distinctIdFromCookie(cookie: string | null | undefined): string {
  if (!cookie || !KEY) return 'server'
  try {
    const name = `ph_${KEY}_posthog`
    const match = cookie.match(new RegExp(`${name}=([^;]+)`))
    if (!match) return 'server'
    const parsed = JSON.parse(decodeURIComponent(match[1]))
    return parsed?.distinct_id || 'server'
  } catch {
    return 'server'
  }
}

/**
 * Send an exception to PostHog Error Tracking from server code. Lands as a
 * first-class `$exception` event (same surface as client autocapture), so
 * server render / action / route-handler failures are visible alongside
 * client errors. No-ops when PostHog isn't configured.
 */
export async function captureServerException(
  error: unknown,
  props: Record<string, unknown> = {},
  cookie?: string | null
): Promise<void> {
  if (!HOST || !KEY) return
  const err = error instanceof Error ? error : new Error(String(error))
  try {
    await fetch(`${HOST}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KEY,
        event: '$exception',
        properties: {
          distinct_id: distinctIdFromCookie(cookie),
          // $exception_list drives PostHog Error Tracking grouping; type + value
          // is the minimum for a usable, grouped issue.
          $exception_list: [
            {
              type: err.name || 'Error',
              value: err.message || String(error),
              mechanism: { handled: false, synthetic: false },
            },
          ],
          $exception_source: 'server',
          // Raw stack as a property — server chunks are minified so this is
          // best-effort context, mirroring the client's errorContext approach.
          $exception_stack_raw: err.stack,
          ...props,
        },
      }),
      // A slow/unreachable PostHog must not hang the error path.
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Swallow — reporting a failure must never itself throw.
  }
}
