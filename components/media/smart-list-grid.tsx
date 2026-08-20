'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { discoverApi } from '@/lib/api-client'
import { smartQuery } from '@/lib/filter-query'
import { Skeleton } from '@/components/ui/skeleton'
import { PosterTile } from '@/components/media/poster-tile'

/** One page of discover. A list nobody scrolls is a list nobody reads. */
const LIMIT = 20

/**
 * A smart list's titles, resolved live.
 *
 * The whole feature is this component plus one column. A smart list stores the
 * browse query and nothing else, so what it shows is whatever the browse page
 * would show right now — a list of "2020s horror above 7" that has this year's
 * films in it without anybody editing it.
 *
 * It costs no new endpoint: `/api/filter` is the same cached discover call the
 * browse pages make, so a smart list that is going around in a group chat is
 * answered from the edge cache the browse page already warmed.
 */
export function SmartListGrid({
  query,
  sizes,
}: {
  query: string
  sizes: string
}) {
  const resolved = useMemo(() => smartQuery(query), [query])

  const { data, isError } = useQuery({
    queryKey: ['smart-list', query],
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: () =>
      discoverApi(resolved.mediaType, resolved.params, { page: 1 }),
  })

  if (isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Could not work out what is in this list right now. Reloading usually
        fixes it.
      </p>
    )
  }

  if (!data) {
    return (
      <ul
        aria-hidden
        className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        {Array.from({ length: 10 }, (_, i) => (
          <li key={i}>
            <Skeleton
              className="aspect-2/3 w-full rounded-lg"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          </li>
        ))}
      </ul>
    )
  }

  const results = (data.results ?? []).slice(0, LIMIT)

  if (results.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing matches this filter at the moment. Smart lists follow the
        filter, so this one fills itself back in when something does.
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {results.map((item) => (
        <li key={item.id}>
          <PosterTile
            item={{
              id: item.id,
              type: resolved.mediaType === 'tv' ? 'series' : 'movie',
              title: item.title || item.name || 'Untitled',
              poster_path: item.poster_path ?? null,
              rating: item.vote_average
                ? Math.round(item.vote_average * 10) / 10
                : null,
            }}
            sizes={sizes}
          />
        </li>
      ))}
    </ul>
  )
}
