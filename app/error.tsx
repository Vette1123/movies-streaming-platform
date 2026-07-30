'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Home, RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react'
import posthog from 'posthog-js'

import { isStaleBundleError, reloadForStaleDeploy } from '@/lib/client-errors'
import { EmptyState } from '@/components/ui/empty-state'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// A tab that outlived a deploy is not a broken app, and saying "something went
// wrong" for it is both wrong and unhelpful — the recovery is already underway.
const STALE_BUNDLE_COPY = {
  icon: RefreshCw,
  title: 'Updating to the latest version',
  description:
    'This page was still running an older build of Reely. Refreshing onto the current one…',
}

const FAULT_COPY = {
  icon: TriangleAlert,
  title: 'Something went wrong',
  description:
    'An unexpected error occurred while loading this page. Try again, or head back home.',
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const pathname = usePathname()
  const staleBundle = isStaleBundleError(error)

  useEffect(() => {
    // Recover before reporting. A retired chunk / dead Server Action ID reaches
    // React as a render error, so this boundary is the ONLY place that can put
    // the user back on the fresh bundle — window.onerror never sees it. If the
    // reload is rate-limited the error UI below still stands as the fallback.
    if (staleBundle) {
      reloadForStaleDeploy()
      return
    }

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
  }, [error, pathname, staleBundle])

  const copy = staleBundle ? STALE_BUNDLE_COPY : FAULT_COPY

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <EmptyState
        icon={copy.icon}
        title={copy.title}
        description={copy.description}
        primaryAction={{ label: 'Try again', onClick: reset, icon: RotateCcw }}
        secondaryAction={{ href: '/', label: 'Go home', icon: Home }}
      />
    </div>
  )
}
