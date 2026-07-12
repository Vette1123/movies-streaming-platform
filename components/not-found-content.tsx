'use client'

import { Clapperboard, Compass, Home } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import { NotFoundTracker } from '@/components/analytics/not-found-tracker'

// EmptyState is a client component and its `icon` props are component
// references (lucide forwardRefs), which cannot be passed across the
// server→client boundary. `not-found.tsx` must stay a server component to
// export `metadata`, so the icon-passing render lives here in the client.
export function NotFoundContent() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <NotFoundTracker />
      <EmptyState
        icon={Compass}
        title="404 — this page wandered off"
        description="The page you're looking for doesn't exist or has moved. Let's get you back to the good stuff."
        primaryAction={{ href: '/', label: 'Go home', icon: Home }}
        secondaryAction={{
          href: '/movies',
          label: 'Browse movies',
          icon: Clapperboard,
        }}
      />
    </main>
  )
}
