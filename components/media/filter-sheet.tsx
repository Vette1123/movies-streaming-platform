'use client'

import React, { useCallback } from 'react'

import { MediaFilter } from '@/types/filter'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Icons } from '@/components/icons'

import { FilterSidebar } from './filter-sidebar'

// Type for filter sections state
interface FilterSections {
  sort: boolean
  genres: boolean
  rating: boolean
  date: boolean
  runtime: boolean
}

interface FilterSheetProps {
  mediaType: 'movie' | 'tv'
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  filter: MediaFilter
  updateFilter: (updates: Partial<MediaFilter>) => void
  toggleGenre: (genreId: number, isExclude?: boolean) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  sections: FilterSections
  toggleSection: (section: string) => void
}

export const FilterSheet = ({
  mediaType,
  isOpen,
  onOpenChange,
  filter,
  updateFilter,
  toggleGenre,
  clearFilters,
  hasActiveFilters,
  sections,
  toggleSection,
}: FilterSheetProps) => {
  // Prevent event bubbling that can cause mobile refresh issues
  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open)
    },
    [onOpenChange]
  )

  const handleTriggerClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onOpenChange(true)
    },
    [onOpenChange]
  )

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleTriggerClick}
          type="button"
        >
          <Icons.filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              !
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[350px] sm:w-[400px] overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icons.sliders className="h-5 w-5" />
            Filter {mediaType === 'movie' ? 'Movies' : 'TV Series'}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <FilterSidebar
            mediaType={mediaType}
            className="max-w-none"
            filter={filter}
            updateFilter={updateFilter}
            toggleGenre={toggleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            sections={sections}
            toggleSection={toggleSection}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
