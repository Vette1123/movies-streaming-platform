'use client'

import { useEffect } from 'react'

import { isStaleBundleError, reloadForStaleDeploy } from '@/lib/client-errors'
import { loadPostHog } from '@/lib/posthog-client'

// Last-resort boundary. app/error.tsx sits INSIDE the root layout, so it can't
// catch an error thrown by the root layout itself (or its providers) — this can.
// global-error replaces the whole document, so it renders its own <html>/<body>
// and can't rely on app providers, fonts, or CSS; styles are inline on purpose.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const staleBundle = isStaleBundleError(error)

  useEffect(() => {
    // Same deal as app/error.tsx: a bundle left behind by a deploy is not a
    // fault, and only a boundary can catch it and reload onto the fresh one.
    if (staleBundle) {
      reloadForStaleDeploy()
      return
    }

    console.error(error)
    // captureException is a no-op if posthog never initialized (the crash may
    // have happened before the provider mounted), so this is best-effort — but
    // when init did run, it gives us the root-level failure with its digest.
    // Forces the module in rather than queueing (see app/error.tsx); the whole
    // document is gone here, so there may be no later flush.
    void loadPostHog()
      .then((posthog) =>
        posthog.captureException(error, {
          error_boundary: 'app/global-error.tsx',
          error_digest: error.digest,
        })
      )
      .catch(() => {
        // never let reporting mask the render error
      })
  }, [error, staleBundle])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          color: '#fafafa',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '1.5rem',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '1.375rem',
              fontWeight: 600,
              margin: '0 0 0.5rem',
            }}
          >
            {staleBundle
              ? 'Updating to the latest version'
              : 'Something went wrong'}
          </h1>
          <p
            style={{ color: '#a1a1aa', lineHeight: 1.5, margin: '0 0 1.5rem' }}
          >
            {staleBundle
              ? 'This page was still running an older build of Reely. Refreshing onto the current one…'
              : 'An unexpected error occurred. Try again, or reload the page.'}
          </p>
          <button
            onClick={reset}
            style={{
              cursor: 'pointer',
              border: 0,
              borderRadius: '0.5rem',
              padding: '0.625rem 1.25rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              background: '#fafafa',
              color: '#09090b',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
