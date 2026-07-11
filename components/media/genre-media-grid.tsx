'use client'

import React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'

import { discoverMoviesAction, discoverSeriesAction } from '@/actions/filter'

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
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
        const totalPages = lastPage?.total_pages ?? 0
        const next = pages.length + 1
        return next <= totalPages ? next : undefined
      },
      initialData: { pages: [initialData], pageParams: [1] },
    })

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = (data?.pages ?? []).flatMap((page) => page?.results ?? [])

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
