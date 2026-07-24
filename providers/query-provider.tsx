'use client'

import { useState } from 'react'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { trackApiError } from '@/lib/analytics'

// A stale open tab whose client bundle references a Server Action ID that no
// longer exists after a redeploy (we ship ~4x/day). The action call comes back
// as a non-RSC response, so TanStack surfaces one of these two messages. It is
// not a code fault — the fix is to reload onto the fresh bundle.
const STALE_DEPLOY_SIGNATURES = [
  'An unexpected response was received from the server',
  'was not found on the server',
  'Failed to find Server Action',
]

const isStaleDeployError = (message: string) =>
  STALE_DEPLOY_SIGNATURES.some((sig) => message.includes(sig))

// Reload at most once per window so a genuinely persistent failure can't trap
// the user in a refresh loop (the fresh bundle has matching action IDs, so a
// real stale-deploy hit never recurs after the first reload).
const RELOAD_GUARD_KEY = 'reely:stale-deploy-reload'
const RELOAD_GUARD_MS = 15_000

const handleStaleDeploy = () => {
  if (typeof window === 'undefined') return

  const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
  // performance.now() avoids clock-skew issues and needs no wall-clock import.
  const now = performance.now()
  if (last && now - last < RELOAD_GUARD_MS) return

  sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
  toast('A new version is available — refreshing…', {
    action: { label: 'Refresh now', onClick: () => window.location.reload() },
  })
  window.setTimeout(() => window.location.reload(), 2500)
}

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // App-wide net: every failed query (after its retries are exhausted) is
        // reported to PostHog automatically, so no client API call can fail
        // silently again — no per-hook wiring needed.
        queryCache: new QueryCache({
          onError: (error, query) => {
            const message =
              error instanceof Error ? error.message : String(error)
            trackApiError({
              source: 'react_query',
              query_key: JSON.stringify(query.queryKey),
              message,
            })
            if (isStaleDeployError(message)) handleStaleDeploy()
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
