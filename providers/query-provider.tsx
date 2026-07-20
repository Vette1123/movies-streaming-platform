'use client'

import { useState } from 'react'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

import { trackApiError } from '@/lib/analytics'

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // App-wide net: every failed query (after its retries are exhausted) is
        // reported to PostHog automatically, so no client API call can fail
        // silently again — no per-hook wiring needed.
        queryCache: new QueryCache({
          onError: (error, query) => {
            trackApiError({
              source: 'react_query',
              query_key: JSON.stringify(query.queryKey),
              message: error instanceof Error ? error.message : String(error),
            })
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
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
