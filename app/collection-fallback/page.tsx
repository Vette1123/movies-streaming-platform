'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { CollectionDetails } from '@/types/collection'
import { getJson } from '@/lib/api-client'
import { collectionDescription } from '@/lib/seo-description'
import { getImageURL } from '@/lib/utils'
import { useLocationPathname } from '@/hooks/use-location-pathname'
import { useServedMetadata } from '@/hooks/use-served-metadata'
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

  // Hydration wipes the head the Worker wrote — see use-served-metadata.
  useServedMetadata(
    data?.name
      ? {
          title: data.name,
          description: collectionDescription(data.name, data.overview),
          image: data.backdrop_path
            ? getImageURL(data.backdrop_path)
            : undefined,
        }
      : null
  )

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
          className="animate-pulse bg-muted/30"
          style={{ height: '28rem' }}
        />
        <div className="container mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="aspect-2/3 animate-pulse rounded-lg bg-muted/30"
            />
          ))}
        </div>
      </div>
    )
  }

  return <CollectionView collection={data} />
}
