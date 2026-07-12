import type { Metadata } from 'next'
import { Clapperboard, Compass, Home } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import { NotFoundTracker } from '@/components/analytics/not-found-tracker'

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
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
