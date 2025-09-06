'use client'

import React from 'react'
import { useInView } from 'react-intersection-observer'

import { MediaResponse, MediaType } from '@/types/media'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { useMediaFilter } from '@/hooks/use-media-filter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/card'
import { MediaGridSkeleton } from '@/components/loaders/media-grid-skeleton'

import { FilterDebug } from './filter-debug'
import { FilterDialog } from './filter-dialog'
import { FilterSheet } from './filter-sheet'
import { FilterSidebar } from './filter-sidebar'

interface FilteredMediaContentProps {
  initialData: MediaResponse
  mediaType: 'movie' | 'tv'
  layout?: 'sidebar' | 'dialog' | 'sheet'
  title?: string
}

export const FilteredMediaContent = ({
  initialData,
  mediaType,
  layout = 'dialog',
  title,
}: FilteredMediaContentProps) => {
  const {
    filter,
    filterParams,
    data,
    isLoading,
    hasActiveFilters,
    isFilterOpen,
    updateFilter,
    toggleGenre,
    clearFilters,
    setIsFilterOpen,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sections,
    toggleSection,
  } = useMediaFilter({ mediaType, initialData })

  const [myRef, inView] = useInView({
    threshold: 0,
    rootMargin: '0px 0px 200px 0px',
  })

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const pages = data?.pages || []

  const FilterComponent = () => {
    switch (layout) {
      case 'sidebar':
        return (
          <FilterSidebar
            mediaType={mediaType}
            filter={filter}
            updateFilter={updateFilter}
            toggleGenre={toggleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            sections={sections}
            toggleSection={toggleSection}
          />
        )
      case 'sheet':
        return (
          <FilterSheet
            mediaType={mediaType}
            isOpen={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            filter={filter}
            updateFilter={updateFilter}
            toggleGenre={toggleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            sections={sections}
            toggleSection={toggleSection}
          />
        )
      default:
        return (
          <FilterDialog
            mediaType={mediaType}
            isOpen={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            filter={filter}
            updateFilter={updateFilter}
            toggleGenre={toggleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            sections={sections}
            toggleSection={toggleSection}
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and Filter Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {title && <h1 className="text-2xl font-bold">{title}</h1>}
        <div className="flex items-center gap-4">
          {layout !== 'sidebar' && <FilterComponent />}
        </div>
      </div>

      {/* Filter Status */}
      {/* {hasActiveFilters && (
        <div className="text-sm text-muted-foreground">
          Showing filtered results for{' '}
          {mediaType === 'movie' ? 'movies' : 'TV series'}
        </div>
      )} */}

      <div
        className={`flex flex-col gap-6 ${layout === 'sidebar' ? 'lg:flex-row lg:gap-8' : ''}`}
      >
        {/* Sidebar Layout - Always visible on desktop to prevent layout shift */}
        {layout === 'sidebar' && (
          <aside className="hidden lg:block w-80 xl:w-96 flex-shrink-0">
            <div className="sticky top-6">
              <FilterComponent />
            </div>
          </aside>
        )}

        {/* Content - Always takes remaining space */}
        <main className="flex-1 min-w-0">
          {/* Mobile Filter for Sidebar Layout */}
          {layout === 'sidebar' && (
            <div className="lg:hidden mb-6">
              <FilterSheet
                mediaType={mediaType}
                isOpen={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                filter={filter}
                updateFilter={updateFilter}
                toggleGenre={toggleGenre}
                clearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
                sections={sections}
                toggleSection={toggleSection}
              />
            </div>
          )}

          {/* Content Grid - Always rendered to prevent layout shift */}
          <div className="space-y-8">
            {/* Initial Loading State */}
            {isLoading && pages.length === 0 ? (
              <MediaGridSkeleton count={20} />
            ) : (
              <>
                {/* Results Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {pages.map((page, index) => (
                    <React.Fragment key={index}>
                      {page?.results?.map((item) => (
                        <Card
                          key={item.id}
                          item={item as MediaType}
                          isTruncateOverview={false}
                          itemType={mediaType}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </div>

                {/* Loading More Skeleton */}
                {isFetchingNextPage && (
                  <div className="mt-8">
                    <MediaGridSkeleton count={10} />
                  </div>
                )}
              </>
            )}

            {/* Infinite Scroll Trigger */}
            <div ref={myRef} className="h-10" />

            {/* No More Results */}
            {!isLoading &&
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
              pages.length > 0 &&
              (pages[0]?.results?.length ?? 0) === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="text-muted-foreground mb-4">
                    No {mediaType === 'movie' ? 'movies' : 'TV series'} found
                    with the current filters
                  </div>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              )}
          </div>
        </main>
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
