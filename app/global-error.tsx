'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

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
  useEffect(() => {
    console.error(error)
    // captureException is a no-op if posthog never initialized (the crash may
    // have happened before the provider mounted), so this is best-effort — but
    // when init did run, it gives us the root-level failure with its digest.
    try {
      posthog.captureException(error, {
        error_boundary: 'app/global-error.tsx',
        error_digest: error.digest,
      })
    } catch {
      // never let reporting mask the render error
    }
  }, [error])

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
          <h1 style={{ fontSize: '1.375rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#a1a1aa', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
            An unexpected error occurred. Try again, or reload the page.
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
