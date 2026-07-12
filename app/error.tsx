'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Home, RotateCcw, TriangleAlert } from 'lucide-react'
import posthog from 'posthog-js'

import { EmptyState } from '@/components/ui/empty-state'

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
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="An unexpected error occurred while loading this page. Try again, or head back home."
        primaryAction={{ label: 'Try again', onClick: reset, icon: RotateCcw }}
        secondaryAction={{ href: '/', label: 'Go home', icon: Home }}
      />
    </main>
  )
}
