import type { Instrumentation } from 'next'

import { captureServerException } from '@/lib/posthog-server'

// Required export. Nothing to bootstrap — server exception capture happens in
// onRequestError below (no long-lived client to initialize on the Worker).
export function register() {}

// Next calls this for EVERY server-side error: React Server Component renders,
// server actions, route handlers, and middleware. These never reach a client
// error boundary (app/error.tsx) or window.onerror, so without this they were
// invisible in PostHog — exactly the class of failure that 500'd the homepage.
// We forward each to PostHog Error Tracking, attributed to the visitor when their
// posthog cookie is present.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  // Header values can arrive as string | string[] (Node IncomingHttpHeaders).
  const rawCookie = request.headers?.cookie
  const cookie = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie

  await captureServerException(
    error,
    {
      error_digest: (error as { digest?: string })?.digest,
      request_path: request.path,
      request_method: request.method,
      router_kind: context.routerKind,
      route_path: context.routePath,
      route_type: context.routeType,
      render_source: context.renderSource,
      revalidate_reason: context.revalidateReason,
    },
    cookie
  )
}
