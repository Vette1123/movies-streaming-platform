'use client'

import React, { useCallback } from 'react'

import { MediaFilter } from '@/types/filter'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Icons } from '@/components/icons'

import { FilterTriggerButton } from './filter-controls'
import { FilterSidebar } from './filter-sidebar'

interface FilterDialogProps {
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
}: FilterDialogProps) => {
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
            Filter {mediaType === 'movie' ? 'Movies' : 'TV Series'}
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
