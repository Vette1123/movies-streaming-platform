'use client'

import React from 'react'
import { discoverMoviesAction, discoverSeriesAction } from '@/actions/filter'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'

import { MediaResponse, MediaType } from '@/types/media'
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
    rootMargin: '0px 0px 200px 0px',
  })

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useInfiniteQuery({
      // Genre-scoped key so each genre keeps its own cache (the shared browse
      // hook keys only on media type and would collide across genres).
      queryKey: ['genre-discover', mediaType, genreId],
      initialPageParam: 1,
      queryFn: ({ pageParam }) => {
        const action =
          mediaType === 'movie' ? discoverMoviesAction : discoverSeriesAction
        return action(
          { with_genres: String(genreId), sort_by: 'popularity.desc' },
          { page: pageParam }
        )
      },
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

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

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
      <div ref={sentinelRef} className="h-10" />
    </div>
  )
}
