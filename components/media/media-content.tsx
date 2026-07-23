'use client'

import React from 'react'
import { Clapperboard } from 'lucide-react'
import { useInView } from 'react-intersection-observer'

import { MediaResponse, MediaType } from '@/types/media'
import { PopularMediaAction } from '@/types/movie-result'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { EmptyState } from '@/components/ui/empty-state'
import { Card } from '@/components/card'

import { FilteredMediaContent } from './filtered-media-content'

interface MediaContentProps {
  media: MediaResponse
  getPopularMediaAction: PopularMediaAction<MediaResponse>
  queryKey: typeof QUERY_KEYS.SERIES_KEY | typeof QUERY_KEYS.MOVIES_KEY
  enableFilters?: boolean
  filterLayout?: 'sidebar' | 'dialog' | 'sheet'
  title?: string
}

export const MediaContent = ({
  media,
  getPopularMediaAction,
  queryKey,
  enableFilters = false,
  filterLayout = 'dialog',
  title,
}: MediaContentProps) => {
  const [myRef, inView] = useInView({
    threshold: 0,
    rootMargin: '0px 0px 200px 0px',
  })
  const { data, fetchNextPage, isFetchingNextPage, hasNextPage } =
    useInfiniteScroll({
      media,
      popularMediaAction: getPopularMediaAction,
      queryKey,
    })

  React.useEffect(() => {
    // Gate on hasNextPage so the sentinel doesn't refetch the last page in a loop
    // once the list is exhausted (only then is it valid for the footer to show).
    if (!enableFilters && inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [enableFilters, inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (enableFilters) {
    const mediaType = queryKey === QUERY_KEYS.MOVIES_KEY ? 'movie' : 'tv'
    return (
      <FilteredMediaContent
        initialData={media}
        mediaType={mediaType}
        layout={filterLayout}
        title={title}
      />
    )
  }

  if (!data)
    return (
      <EmptyState
        icon={Clapperboard}
        title="Nothing to show right now"
        description="We couldn't load any titles here. Refresh the page or head back home and try again."
        primaryAction={{ href: '/', label: 'Back to home' }}
      />
    )
  const { pages } = data

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
      {pages &&
        pages.map((page, index) => (
          <React.Fragment key={index}>
            {page &&
              page?.results?.map((movie) => (
                <Card
                  key={movie.id}
                  item={movie as MediaType}
                  isTruncateOverview={false}
                  itemType={queryKey === QUERY_KEYS.MOVIES_KEY ? 'movie' : 'tv'}
                />
              ))}
          </React.Fragment>
        ))}
      {/* While the next page is in flight, fill the grid with reserved skeleton
          cells (same 2/3 aspect as a poster). This keeps the footer from
          surfacing into the gap and getting shoved back down when the page lands —
          the user scrolls straight from real cards into placeholders into real
          cards, no jump. */}
      {isFetchingNextPage &&
        Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="bg-muted/70 aspect-[2/3] w-full animate-pulse rounded-lg"
          />
        ))}
      {/* Sentinel sits AFTER the skeletons so it's only re-observed once the new
          real cards have replaced them — prevents a double-fire at the seam. */}
      <div ref={myRef} />
    </div>
  )
}
