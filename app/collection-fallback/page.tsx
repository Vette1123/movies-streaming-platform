'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { CollectionDetails } from '@/types/collection'
import { getJson } from '@/lib/api-client'
import { useLocationPathname } from '@/hooks/use-location-pathname'
import { CollectionView } from '@/components/collection/collection-view'

// The shell for franchise ids the build did not prerender — the collection
// twin of app/media-fallback. cloudflare/worker.js serves this page's exported
// HTML for /collection/<id> with the real metadata injected.
//
// The prerendered set comes from `belongs_to_collection` on prerendered movies,
// so the ids that land here are the ones reachable from a tail movie detail
// page. Without this they were the only dead link left on the site.

const parseId = (pathname: string): string | null =>
  pathname.match(/^\/collection\/(\d+)/)?.[1] ?? null

export default function CollectionFallbackPage() {
  const pathname = useLocationPathname()
  const id = React.useMemo(() => parseId(pathname), [pathname])

  const { data, isError } = useQuery<CollectionDetails>({
    queryKey: ['collection-fallback', id],
    enabled: Boolean(id),
    staleTime: 60 * 60 * 1000,
    queryFn: () => getJson<CollectionDetails>(`/api/collection/${id}`),
  })

  // The Worker injects the real <title>, but hydration re-renders the shell's
  // own — without this the tab reverts to the generic site title.
  React.useEffect(() => {
    if (data?.name) document.title = data.name
  }, [data])

  if (isError) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">
          We couldn&apos;t load this collection. Please try again.
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="relative">
        <div
          className="bg-muted/30 animate-pulse"
          style={{ height: '28rem' }}
        />
        <div className="container mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="bg-muted/30 aspect-2/3 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    )
  }

  return <CollectionView collection={data} />
}
