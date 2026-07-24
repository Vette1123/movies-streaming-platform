'use client'

import React from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Icons } from '@/components/icons'

import {
  FilterOverlayProps,
  filterOverlayTitle,
  FilterTriggerButton,
  useFilterOverlay,
} from './filter-controls'
import { FilterSidebar } from './filter-sidebar'

export const FilterDialog = ({
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
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <FilterTriggerButton
          activeFilterCount={activeFilterCount}
          onClick={handleTriggerClick}
        />
      </DialogTrigger>
      <DialogContent
        className="max-h-[80vh] max-w-md overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.sliders className="size-5" />
            {filterOverlayTitle(mediaType)}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto">
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
      </DialogContent>
    </Dialog>
  )
}
