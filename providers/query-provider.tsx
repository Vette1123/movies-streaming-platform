'use client'

import { useEffect, useState } from 'react'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

import { trackApiError } from '@/lib/analytics'
import {
  apiErrorStatus,
  errorMessage,
  isExpectedApiStatus,
  isStaleChunkError,
  isStaleDeployError,
  isTransportError,
  reloadForStaleDeploy,
} from '@/lib/client-errors'

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // App-wide net: every failed query (after its retries are exhausted) is
        // reported to PostHog automatically, so no client API call can fail
        // silently again — no per-hook wiring needed.
        queryCache: new QueryCache({
          onError: (error, query) => {
            const message = errorMessage(error)
            const stale = isStaleDeployError(message)
            const status = apiErrorStatus(error)
            trackApiError({
              source: 'react_query',
              query_key: JSON.stringify(query.queryKey),
              message,
              status,
              // A dropped connection, an offline tab, a bundle left behind by a
              // deploy, or a 4xx answer to a made-up id is not a code fault.
              // Keep the api_error event so the failure rate stays measurable,
              // but don't file it as an $exception — that noise buried the real
              // regressions.
              expected:
                stale ||
                isTransportError(message) ||
                isExpectedApiStatus(status),
            })
            if (stale) reloadForStaleDeploy()
          },
        }),
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // Transient Worker/TMDB hiccups should self-heal instead of leaving
            // a blank UI. Exponential backoff, capped — but never for a 4xx,
            // which will answer exactly the same three times and costs a Worker
            // invocation each.
            retry: (failureCount, error) =>
              !isExpectedApiStatus(apiErrorStatus(error)) && failureCount < 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            staleTime: 60_000,
          },
        },
      })
  )

  // The other half of stale-deploy recovery. A Server Action call surfaces
  // through the query cache above, but a lazy chunk from the retired build
  // fails outside React entirely — as a window `error` (script/module load) or
  // an unhandled rejection from a dynamic import. Both leave the UI wedged
  // until the tab reloads, so route them to the same guarded reload. Mounted
  // here because QueryProvider already wraps the whole app.
  useEffect(() => {
    const handle = (message: string) => {
      if (isStaleChunkError(message)) reloadForStaleDeploy()
    }
    const onError = (event: ErrorEvent) => {
      // A `<script>` whose src 404s fires an `error` event on the ELEMENT with
      // no message and no `error` object, and it does not bubble — the capture
      // phase below is the only way window sees it at all. That's the
      // "Refused to execute script … MIME type ('text/html')" case: the Worker
      // answered a retired chunk URL with its HTML 404 page. Identify it by
      // target instead of by message.
      const { target } = event
      if (
        target instanceof HTMLScriptElement &&
        target.src.includes('/_next/static/')
      ) {
        reloadForStaleDeploy()
        return
      }
      handle(`${event.message} ${errorMessage(event.error)}`)
    }
    const onRejection = (event: PromiseRejectionEvent) =>
      handle(errorMessage(event.reason))

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
