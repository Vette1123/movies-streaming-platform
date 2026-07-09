'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const pathname = usePathname()

  useEffect(() => {
    console.error(error)
    // Explicitly report errors that reached the route error boundary. React
    // catches render errors before they hit window.onerror, so this is what
    // gives PostHog the component context (Next's `digest` maps to the server
    // component stack) plus the exact screen it broke on.
    posthog.captureException(error, {
      error_boundary: 'app/error.tsx',
      error_digest: error.digest,
      error_pathname: pathname,
    })
  }, [error, pathname])

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-md border px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        >
          Go Home
        </Link>
      </div>
    </main>
  )
}
