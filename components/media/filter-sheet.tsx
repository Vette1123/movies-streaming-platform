'use client'

import React from 'react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Icons } from '@/components/icons'

import {
  FilterOverlayProps,
  filterOverlayTitle,
  FilterTriggerButton,
  useFilterOverlay,
} from './filter-controls'
import { FilterSidebar } from './filter-sidebar'

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
}: FilterOverlayProps) => {
  const { handleOpenChange, handleTriggerClick } =
    useFilterOverlay(onOpenChange)

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
            {filterOverlayTitle(mediaType)}
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
