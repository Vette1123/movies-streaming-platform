'use client'

import React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'

import { MediaResponse, MediaType } from '@/types/media'
import { discoverApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/card'
import { MediaGridSkeleton } from '@/components/loaders/media-grid-skeleton'

interface GenreMediaGridProps {
  mediaType: 'movie' | 'tv'
  genreId: number
  initialData: MediaResponse
}

export const GenreMediaGrid = ({
  mediaType,
  genreId,
  initialData,
}: GenreMediaGridProps) => {
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
  } = useInfiniteQuery({
    // Genre-scoped key so each genre keeps its own cache (the shared browse
    // hook keys only on media type and would collide across genres).
    queryKey: ['genre-discover', mediaType, genreId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      discoverApi(
        mediaType,
        { with_genres: String(genreId), sort_by: 'popularity.desc' },
        { page: pageParam }
      ),
    getNextPageParam: (lastPage, pages) => {
      // Don't gate on `total_pages`: the runtime discover response (server
      // action, Cloudflare) can come back without it — or `initialData` can
      // ship empty from a build-time TMDB hiccup — which pins total_pages at 0
      // and freezes pagination at page 1. Instead paginate until a page returns
      // no results, matching the resilient browse hook. TMDB caps discover at
      // 500 pages, so an empty page is the natural stop.
      if (!lastPage?.results?.length) return undefined
      if (pages.length >= 500) return undefined
      return pages.length + 1
    },
    initialData: { pages: [initialData], pageParams: [1] },
  })

  // Auto-load the next page when the sentinel scrolls into view. Skip while a
  // fetch is in flight and — crucially — while in an error state: otherwise a
  // failed page (e.g. a Cloudflare challenge blocking the server-action POST on
  // privacy browsers) would keep the sentinel in view and hammer fetchNextPage
  // in a tight retry loop. On error we stop and surface a manual retry instead.
  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isError) {
      // Small debounce (matches the browse list) so a fling-scroll that flickers
      // the sentinel in/out doesn't fire a burst of duplicate fetchNextPage calls.
      const timeoutId = setTimeout(() => fetchNextPage(), 100)
      return () => clearTimeout(timeoutId)
    }
  }, [inView, hasNextPage, isFetchingNextPage, isError, fetchNextPage])

  const items = (data?.pages ?? []).flatMap((page) => page?.results ?? [])

  // The page ships with empty initialData when TMDB hiccups at build time, then
  // refetches on mount. Show the skeleton during that refetch instead of the
  // "empty genre" message, which would otherwise flash for a loaded genre.
  if (items.length === 0 && isFetching) {
    return <MediaGridSkeleton count={10} />
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-20 text-center">
        Nothing here yet — try another genre.
      </p>
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

      {/* Auto-load failed (network, or a CF challenge blocking the server action
          on privacy browsers). Don't dead-end the list — let the user retry. */}
      {isError && !isFetchingNextPage && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-muted-foreground text-sm">
            Couldn&apos;t load more titles.
          </p>
          <Button variant="outline" onClick={() => fetchNextPage()}>
            Try again
          </Button>
        </div>
      )}

      {/* Sentinel drives infinite scroll; hidden on error so it can't retrigger
          the auto-fetch loop (the retry button takes over there). */}
      {hasNextPage && !isError && <div ref={sentinelRef} className="h-10" />}
    </div>
  )
}
