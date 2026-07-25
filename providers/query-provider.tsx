'use client'

import { useEffect, useState } from 'react'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

import { trackApiError } from '@/lib/analytics'
import {
  errorMessage,
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
            trackApiError({
              source: 'react_query',
              query_key: JSON.stringify(query.queryKey),
              message,
              // A dropped connection, an offline tab, or a bundle left behind by
              // a deploy is not a code fault. Keep the api_error event so the
              // failure rate stays measurable, but don't file it as an
              // $exception — that noise buried the real regressions.
              expected: stale || isTransportError(message),
            })
            if (stale) reloadForStaleDeploy()
          },
        }),
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // Transient Worker/TMDB hiccups should self-heal instead of leaving
            // a blank UI. Exponential backoff, capped.
            retry: 2,
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
    const onError = (event: ErrorEvent) =>
      handle(`${event.message} ${errorMessage(event.error)}`)
    const onRejection = (event: PromiseRejectionEvent) =>
      handle(errorMessage(event.reason))

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
