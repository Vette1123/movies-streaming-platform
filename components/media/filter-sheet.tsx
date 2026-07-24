'use client'

import React, { useCallback } from 'react'

import { MediaFilter } from '@/types/filter'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Icons } from '@/components/icons'

import { FilterTriggerButton } from './filter-controls'
import { FilterSidebar } from './filter-sidebar'

interface FilterSheetProps {
  mediaType: 'movie' | 'tv'
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  filter: MediaFilter
  updateFilter: (updates: Partial<MediaFilter>) => void
  cycleGenre: (genreId: number) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
}

export const FilterSheet = ({
  mediaType,
  isOpen,
  onOpenChange,
  filter,
  updateFilter,
  cycleGenre,
  clearFilters,
  hasActiveFilters,
  activeFilterCount,
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
        <FilterTriggerButton
          activeFilterCount={activeFilterCount}
          onClick={handleTriggerClick}
        />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[350px] overflow-hidden sm:w-[400px]"
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
            cycleGenre={cycleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
