'use client'

import React from 'react'
import { Clapperboard } from 'lucide-react'
import { useInView } from 'react-intersection-observer'

import { MediaResponse, MediaType } from '@/types/media'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { EmptyState } from '@/components/ui/empty-state'
import { Card } from '@/components/card'
import { GridSkeletonCells } from '@/components/loaders/grid-skeleton-cells'

import { FilteredMediaContent } from './filtered-media-content'
import { ListLoadError } from './list-load-error'

interface MediaContentProps {
  media: MediaResponse
  queryKey: typeof QUERY_KEYS.SERIES_KEY | typeof QUERY_KEYS.MOVIES_KEY
  enableFilters?: boolean
  filterLayout?: 'sidebar' | 'dialog' | 'sheet'
}

export const MediaContent = ({
  media,
  queryKey,
  enableFilters = false,
  filterLayout = 'dialog',
}: MediaContentProps) => {
  const [myRef, inView] = useInView({
    threshold: 0,
    // Prefetch a full viewport early so the next page is in flight before a
    // fling-scroll reaches the bottom (pairs with the footer-hide below).
    rootMargin: '0px 0px 900px 0px',
  })
  const { data, fetchNextPage, isFetchingNextPage, hasNextPage, isError } =
    useInfiniteScroll({
      media,
      queryKey,
    })

  React.useEffect(() => {
    // Gate on hasNextPage so the sentinel doesn't refetch the last page in a loop
    // once the list is exhausted (only then is it valid for the footer to show).
    // Gate on !isError too: a failed page leaves the sentinel in view, and the
    // effect would otherwise retry it on every render.
    if (
      !enableFilters &&
      inView &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isError
    ) {
      fetchNextPage()
    }
  }, [
    enableFilters,
    inView,
    hasNextPage,
    isFetchingNextPage,
    isError,
    fetchNextPage,
  ])

  // Hide the global footer while more pages exist so a fling to the bottom can't
  // flash it during the network gap. Only meaningful on the non-filter path;
  // the filter path owns the same flag. See FilteredMediaContent for the why.
  React.useEffect(() => {
    if (enableFilters) return
    document.body.dataset.listHasMore = hasNextPage ? 'true' : 'false'
    return () => {
      delete document.body.dataset.listHasMore
    }
  }, [enableFilters, hasNextPage])

  if (enableFilters) {
    const mediaType = queryKey === QUERY_KEYS.MOVIES_KEY ? 'movie' : 'tv'
    return (
      <FilteredMediaContent
        initialData={media}
        mediaType={mediaType}
        layout={filterLayout}
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
    <>
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
                    itemType={
                      queryKey === QUERY_KEYS.MOVIES_KEY ? 'movie' : 'tv'
                    }
                  />
                ))}
            </React.Fragment>
          ))}
        {/* While the next page is in flight, fill the grid with reserved skeleton
            cells (same 2/3 aspect as a poster). This keeps the footer from
            surfacing into the gap and getting shoved back down when the page lands —
            the user scrolls straight from real cards into placeholders into real
            cards, no jump. */}
        {isFetchingNextPage && <GridSkeletonCells count={10} />}
        {/* Sentinel sits AFTER the skeletons so it's only re-observed once the new
            real cards have replaced them — prevents a double-fire at the seam.
            Dropped on error so it can't keep re-triggering the failed fetch. */}
        {!isError && <div ref={myRef} />}
      </div>
      {/* Page 1 is always prerendered here, so only a later page can fail —
          the compact strip keeps the loaded cards and offers a retry. */}
      {isError && !isFetchingNextPage && (
        <ListLoadError isEmpty={false} onRetry={fetchNextPage} />
      )}
    </>
  )
}
