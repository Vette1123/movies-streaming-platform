'use client'

import React from 'react'

import { MediaFilter } from '@/types/filter'
import { useMediaFilter } from '@/hooks/use-media-filter'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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

interface FilterDialogProps {
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

export const FilterDialog = ({
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
}: FilterDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Icons.filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              !
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden">
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
            toggleGenre={toggleGenre}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            sections={sections}
            toggleSection={toggleSection}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
