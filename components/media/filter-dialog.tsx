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
      <DialogContent className="flex max-h-[80dvh] max-w-md flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.sliders className="size-5" />
            {filterOverlayTitle(mediaType)}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
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
