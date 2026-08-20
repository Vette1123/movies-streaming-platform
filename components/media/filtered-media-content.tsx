'use client'

import React, { useCallback, useState } from 'react'
import { FilterX, SearchX } from 'lucide-react'
import { useInView } from 'react-intersection-observer'

import { MediaResponse, MediaType } from '@/types/media'
import { useHiddenMedia } from '@/hooks/use-hidden-media'
import { useMediaFilter } from '@/hooks/use-media-filter'
import { EmptyState } from '@/components/ui/empty-state'
import { Card } from '@/components/card'
import { GridSkeletonCells } from '@/components/loaders/grid-skeleton-cells'
import { MediaGridSkeleton } from '@/components/loaders/media-grid-skeleton'

import { FilterActiveChips } from './filter-active-chips'
import { FilterDebug } from './filter-debug'
import { FilterDialog } from './filter-dialog'
import { FilterSheet } from './filter-sheet'
import { FilterSidebar } from './filter-sidebar'
import { ListLoadError } from './list-load-error'

interface FilteredMediaContentProps {
  initialData: MediaResponse
  mediaType: 'movie' | 'tv'
  layout?: 'sidebar' | 'dialog' | 'sheet'
}

// Reads filter state from the URL (nuqs), so this whole subtree bails to
// client-side rendering under a static prerender. Nothing SEO-bearing may live
// here — the page heading and copy are rendered by MediaListPage on the server.
export const FilteredMediaContent = ({
  initialData,
  mediaType,
  layout = 'dialog',
}: FilteredMediaContentProps) => {
  // Local state for filter open/close to prevent URL pollution and mobile refresh issues
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  // Titles marked "not interested". Empty on the server and until localStorage
  // has been read, which is correct: the grid renders the same markup a crawler
  // sees, then drops the hidden rows once the browser knows about them.
  const { hiddenIds } = useHiddenMedia()

  const {
    filter,
    filterParams,
    data,
    isLoading,
    hasActiveFilters,
    activeFilterCount,
    updateFilter,
    cycleGenre,
    clearFilters,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isError,
    refetch,
  } = useMediaFilter({ mediaType, initialData })

  const [myRef, inView] = useInView({
    threshold: 0,
    // Prefetch a full viewport early so the next page is already in flight before
    // a fling-scroll reaches the bottom — otherwise the user overruns the 10
    // reserved skeleton rows and lands on the site footer during the network gap.
    rootMargin: '0px 0px 900px 0px',
  })

  // Optimized infinite scroll with debounce to prevent multiple rapid calls.
  // Gated on `!isError` for the same reason as the genre grid: a failed page
  // leaves the sentinel parked in view, and without this the effect re-fires
  // fetchNextPage on every render for as long as the failure lasts.
  React.useEffect(() => {
    if (
      inView &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isLoading &&
      !isError
    ) {
      const timeoutId = setTimeout(() => {
        fetchNextPage()
      }, 100) // Small debounce to prevent rapid calls

      return () => clearTimeout(timeoutId)
    }
  }, [
    inView,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    fetchNextPage,
  ])

  // Suppress the global site footer while more pages exist. The footer is the
  // last element in the root layout and shorter than the viewport, so a
  // fling-scroll to the absolute bottom ALWAYS reveals it during the network gap
  // between pages — no amount of skeleton reserve fixes that (scroll-max follows
  // document height). Hiding it until the list is exhausted is the deterministic
  // fix and standard for infinite feeds; it reappears once hasNextPage is false.
  React.useEffect(() => {
    document.body.dataset.listHasMore = hasNextPage ? 'true' : 'false'
    return () => {
      delete document.body.dataset.listHasMore
    }
  }, [hasNextPage])

  // Handle filter close on mobile to prevent issues
  const handleFilterOpenChange = useCallback((open: boolean) => {
    setIsFilterOpen(open)
  }, [])

  const pages = data?.pages || []
  const hasItems = pages.some((page) => (page?.results?.length ?? 0) > 0)
  // A settled query with zero pages can only mean the first fetch failed — a
  // successful one always yields a page, even an empty-results one. Deliberately
  // NOT keyed on `isError`: refetch() clears the error while it re-runs, and if
  // the retry fails too the flag doesn't reliably come back, which left the grid
  // blank forever again the moment the user pressed Try again.
  const isBusy = isLoading || isFetching
  const showFullError = !isBusy && pages.length === 0
  const showInitialSkeleton = isBusy && pages.length === 0

  const renderFilter = () => {
    switch (layout) {
      case 'sidebar':
        return (
          <FilterSidebar
            mediaType={mediaType}
            filter={filter}
            updateFilter={updateFilter}
            cycleGenre={cycleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )
      case 'sheet':
        return (
          <FilterSheet
            mediaType={mediaType}
            isOpen={isFilterOpen}
            onOpenChange={handleFilterOpenChange}
            filter={filter}
            updateFilter={updateFilter}
            cycleGenre={cycleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        )
      default:
        return (
          <FilterDialog
            mediaType={mediaType}
            isOpen={isFilterOpen}
            onOpenChange={handleFilterOpenChange}
            filter={filter}
            updateFilter={updateFilter}
            cycleGenre={cycleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter controls for the non-sidebar layouts (sidebar renders its own
          below, plus the mobile sheet). */}
      {layout !== 'sidebar' && (
        <div className="flex items-center justify-end gap-4">
          {renderFilter()}
        </div>
      )}

      <div
        className={`flex flex-col gap-6 ${layout === 'sidebar' ? 'lg:flex-row lg:gap-8' : ''}`}
      >
        {/* Sidebar Layout - Always visible on desktop to prevent layout shift */}
        {layout === 'sidebar' && (
          <aside className="hidden w-80 flex-shrink-0 lg:block xl:w-96">
            <div className="sticky top-6">{renderFilter()}</div>
          </aside>
        )}

        {/* Content - Always takes remaining space. <div>, not <main>: the root
            layout already owns the single page <main> landmark. */}
        <div className="min-w-0 flex-1">
          {/* Mobile Filter for Sidebar Layout */}
          {layout === 'sidebar' && (
            <div className="mb-6 lg:hidden">
              <FilterSheet
                mediaType={mediaType}
                isOpen={isFilterOpen}
                onOpenChange={handleFilterOpenChange}
                filter={filter}
                updateFilter={updateFilter}
                cycleGenre={cycleGenre}
                clearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
              />
            </div>
          )}

          {/* Active filter chips — at-a-glance summary of what's applied, each
              removable in one tap, plus Clear all. The single biggest legibility
              win over the old "!" badge. */}
          {hasActiveFilters && (
            <FilterActiveChips
              mediaType={mediaType}
              filter={filter}
              updateFilter={updateFilter}
              clearFilters={clearFilters}
              className="mb-6"
            />
          )}

          {/* Content Grid - Always rendered to prevent layout shift */}
          <div className="space-y-8">
            {/* Fetch failed before anything rendered. This branch is what keeps
                a failed /api/filter from leaving the grid on skeletons forever:
                react-query gives up, isLoading drops, and every other branch
                below needs a loaded page it will never get. */}
            {showFullError && <ListLoadError isEmpty onRetry={refetch} />}

            {!showFullError && (
              <>
                {/* Initial Loading State */}
                {showInitialSkeleton && <MediaGridSkeleton count={20} />}

                {/* Results Grid. The "load more" skeletons live INSIDE this same
                    grid (not a detached grid below), so they continue the exact
                    row layout — filling the last partial row first — and the real
                    cards then replace them cell-for-cell. That's what keeps the
                    footer from lurching when a page lands: the reserved height
                    never changes across skeleton → real. */}
                {!showInitialSkeleton && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {pages.map((page, index) => (
                      <React.Fragment key={index}>
                        {page?.results
                          ?.filter((item) => !hiddenIds.has(item.id))
                          .map((item) => (
                            <Card
                              key={item.id}
                              item={item as MediaType}
                              isTruncateOverview={false}
                              itemType={mediaType}
                            />
                          ))}
                      </React.Fragment>
                    ))}
                    {isFetchingNextPage && <GridSkeletonCells count={10} />}
                  </div>
                )}
              </>
            )}

            {/* A later page failed — keep the cards already on screen and offer
                a manual retry instead of dead-ending the list. */}
            {isError && hasItems && !isFetchingNextPage && (
              <ListLoadError isEmpty={false} onRetry={fetchNextPage} />
            )}

            {/* Infinite Scroll Trigger. Removed on error so it cannot sit parked
                in view re-triggering the auto-fetch; the retry button owns it. */}
            {!isError && <div ref={myRef} className="h-10" />}

            {/* No More Results */}
            {!isLoading &&
              !isError &&
              !isFetchingNextPage &&
              !hasNextPage &&
              pages.length > 0 &&
              (pages[0]?.results?.length ?? 0) > 0 && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">No more results</div>
                </div>
              )}

            {/* No Results */}
            {!isLoading &&
              !isError &&
              pages.length > 0 &&
              (pages[0]?.results?.length ?? 0) === 0 && (
                <EmptyState
                  icon={SearchX}
                  title={`No ${mediaType === 'movie' ? 'movies' : 'series'} match these filters`}
                  description="Nothing lined up with the filters you picked. Loosen a few and we'll surface more titles."
                  primaryAction={{
                    label: 'Clear filters',
                    onClick: clearFilters,
                    icon: FilterX,
                  }}
                  className="min-h-[50vh]"
                />
              )}
          </div>
        </div>
      </div>

      {/* Debug Component - Only in development */}
      <FilterDebug
        filter={filter}
        filterParams={filterParams}
        enabled={process.env.NODE_ENV === 'development'}
      />
    </div>
  )
}
