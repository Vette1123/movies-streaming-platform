'use client'

import React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'

import { FilterParams } from '@/types/filter'
import { MediaResponse, MediaType } from '@/types/media'
import { discoverApi } from '@/lib/api-client'
import { Card } from '@/components/card'
import { MediaGridSkeleton } from '@/components/loaders/media-grid-skeleton'

import { ListLoadError } from './list-load-error'

// One infinite discover grid, used by every surface that is "a filter set,
// paginated": genre pages and the mood picker so far. Both had their own copy
// of the same query + sentinel + error branches, and the copies had already
// drifted (different column counts, one of them missing the duplicate-id
// guard). The differences that matter are props; everything else is shared.

interface DiscoverGridProps {
  mediaType: 'movie' | 'tv'
  /** Discover query params, exactly as /api/filter takes them. */
  filters: FilterParams
  /** What makes this grid's cache distinct from another grid's. */
  cacheKey: (string | number)[]
  /** Prerendered page 1, when the caller has one. */
  initialData?: MediaResponse
  emptyMessage?: string
}

export const DiscoverGrid = ({
  mediaType,
  filters,
  cacheKey,
  initialData,
  emptyMessage = 'Nothing here yet — try another filter.',
}: DiscoverGridProps) => {
  const [sentinelRef, inView] = useInView({
    threshold: 0,
    // Prefetch a full viewport early (matches the browse list) so the next page
    // is already in flight before a mobile fling-scroll reaches the bottom. A
    // small 200px margin gets overshot by momentum scrolling on phones and the
    // sentinel never trips — which read as "pagination doesn't work on mobile".
    rootMargin: '0px 0px 900px 0px',
  })

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['discover', mediaType, ...cacheKey],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      discoverApi(mediaType, filters, { page: pageParam }),
    getNextPageParam: (lastPage, pages) => {
      // Don't gate on `total_pages`: the runtime discover response (Worker) can
      // come back without it — or `initialData` can ship empty from a
      // build-time TMDB hiccup — which pins total_pages at 0 and freezes
      // pagination at page 1. Paginate until a page returns no results
      // instead. TMDB caps discover at 500 pages, so that is the other stop.
      if (!lastPage?.results?.length) return undefined
      if (pages.length >= 500) return undefined
      return pages.length + 1
    },
    initialData: initialData
      ? { pages: [initialData], pageParams: [1] }
      : undefined,
  })

  // Auto-load the next page when the sentinel scrolls into view. Skip while a
  // fetch is in flight and — crucially — while in an error state: otherwise a
  // failed page would keep the sentinel in view and hammer fetchNextPage in a
  // tight retry loop. On error we stop and surface a manual retry instead.
  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isError) {
      // Small debounce (matches the browse list) so a fling-scroll that flickers
      // the sentinel in/out doesn't fire a burst of duplicate fetchNextPage calls.
      const timeoutId = setTimeout(() => fetchNextPage(), 100)
      return () => clearTimeout(timeoutId)
    }
  }, [inView, hasNextPage, isFetchingNextPage, isError, fetchNextPage])

  // TMDB's discover pages overlap: the same title can come back on page 2 and
  // again on page 3 as popularity shifts under the cursor. Unguarded that is a
  // duplicate React key and a card rendered twice.
  const items = React.useMemo(() => {
    const seen = new Set<number>()
    return (data?.pages ?? [])
      .flatMap((page) => page?.results ?? [])
      .filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
  }, [data])

  // A page can ship empty initialData when TMDB hiccups at build time, then
  // refetch on mount. Show the skeleton during that refetch instead of the
  // empty message, which would otherwise flash for a perfectly full list.
  if (items.length === 0 && isFetching) {
    return <MediaGridSkeleton count={10} />
  }

  // An errored page 1 has no results either, so it must be told apart from a
  // genuinely empty filter — otherwise a failed fetch reads as "no titles".
  if (items.length === 0 && isError) {
    return <ListLoadError isEmpty onRetry={refetch} />
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-20 text-center">{emptyMessage}</p>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-6">
        {items.map((item) => (
          <Card
            key={`${item.id}-${item.media_type ?? mediaType}`}
            item={item as MediaType}
            itemType={mediaType}
            isTruncateOverview={false}
          />
        ))}
      </div>

      {isFetchingNextPage && <MediaGridSkeleton count={10} />}

      {/* Auto-load failed (network, or a CF challenge on privacy browsers).
          Don't dead-end the list — let the user retry. */}
      {isError && !isFetchingNextPage && (
        <ListLoadError isEmpty={false} onRetry={fetchNextPage} />
      )}

      {/* Sentinel drives infinite scroll; hidden on error so it can't retrigger
          the auto-fetch loop (the retry button takes over there). */}
      {hasNextPage && !isError && <div ref={sentinelRef} className="h-10" />}
    </div>
  )
}
