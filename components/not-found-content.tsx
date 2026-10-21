'use client'

import { useRouter } from 'next/navigation'
import { Clapperboard, Compass, Home } from 'lucide-react'

import { matchCardHref } from '@/lib/match-night'
import { EmptyState } from '@/components/ui/empty-state'
import { NotFoundTracker } from '@/components/analytics/not-found-tracker'
import { MediaSearchPicker } from '@/components/media-search-picker'

// The popular places, as links. A dead URL is a visitor on the way out and a
// crawler on a path it has never seen; both want somewhere to go, and a link
// is cheaper for the site than a page that has to be built to say "gone".
const PLACES = [
  { href: '/movies', label: 'Movies' },
  { href: '/tv-shows', label: 'TV shows' },
  { href: '/people', label: 'People' },
  { href: '/lists', label: 'Lists' },
  { href: '/reels', label: 'Trailers' },
  { href: '/start', label: 'What should I watch?' },
]

// EmptyState is a client component and its `icon` props are component
// references (lucide forwardRefs), which cannot be passed across the
// server→client boundary. `not-found.tsx` must stay a server component to
// export `metadata`, so the icon-passing render lives here in the client.
export function NotFoundContent() {
  const router = useRouter()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <NotFoundTracker />
      <EmptyState
        icon={Compass}
        // The only heading on this page, so it has to be the h1.
        headingLevel="h1"
        title="404 — this page wandered off"
        description="The page you're looking for doesn't exist or has moved. Search for what you wanted, or pick a door below."
        primaryAction={{ href: '/', label: 'Go home', icon: Home }}
        secondaryAction={{
          href: '/movies',
          label: 'Browse movies',
          icon: Clapperboard,
        }}
      />
      {/* A dead end with a search box on it is a detour, not a dead end: the
          visitor who mistyped a title gets the title. */}
      <div className="mt-8 w-full max-w-md">
        <MediaSearchPicker
          inputId="not-found-search"
          label="Search instead"
          placeholder="Search any film or series"
          onPick={(card) => router.push(matchCardHref(card))}
        />
      </div>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        {PLACES.map((place) => (
          <li key={place.href}>
            <a
              href={place.href}
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {place.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
