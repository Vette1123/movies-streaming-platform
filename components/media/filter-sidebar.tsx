'use client'

import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { MediaFilter, SortOption } from '@/types/filter'
import { MOVIES_GENRE, TV_GENRE } from '@/lib/genres'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Icons } from '@/components/icons'

// Type for filter sections state
interface FilterSections {
  sort: boolean
  genres: boolean
  rating: boolean
  date: boolean
  runtime: boolean
}

interface FilterSidebarProps {
  mediaType: 'movie' | 'tv'
  className?: string
  filter: MediaFilter
  updateFilter: (updates: Partial<MediaFilter>) => void
  toggleGenre: (genreId: number, isExclude?: boolean) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  sections: FilterSections
  toggleSection: (section: string) => void
}

interface FilterSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  sectionKey?: string
  onToggle?: (isOpen: boolean) => void
  isOpen?: boolean
}

const FilterSection = ({
  title,
  children,
  defaultOpen = false,
  className,
  sectionKey,
  onToggle,
  isOpen: controlledIsOpen,
}: FilterSectionProps) => {
  const [localIsOpen, setLocalIsOpen] = React.useState(defaultOpen)

  // Use controlled state if provided, otherwise use local state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : localIsOpen

  const handleToggle = () => {
    const newState = !isOpen
    if (onToggle) {
      onToggle(newState)
    } else {
      setLocalIsOpen(newState)
    }
  }

  return (
    <div className={cn('border-b border-border/40 pb-4', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="w-full justify-between p-0 h-auto font-medium text-sm text-foreground hover:bg-transparent"
        aria-expanded={isOpen}
      >
        {title}
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      {isOpen && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  )
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'popularity.desc', label: 'Popularity (High to Low)' },
  { value: 'popularity.asc', label: 'Popularity (Low to High)' },
  { value: 'vote_average.desc', label: 'Rating (High to Low)' },
  { value: 'vote_average.asc', label: 'Rating (Low to High)' },
  { value: 'release_date.desc', label: 'Release Date (Newest)' },
  { value: 'release_date.asc', label: 'Release Date (Oldest)' },
  { value: 'original_title.asc', label: 'Title (A-Z)' },
  { value: 'original_title.desc', label: 'Title (Z-A)' },
]

const tvSortOptions: { value: SortOption; label: string }[] = [
  { value: 'popularity.desc', label: 'Popularity (High to Low)' },
  { value: 'popularity.asc', label: 'Popularity (Low to High)' },
  { value: 'vote_average.desc', label: 'Rating (High to Low)' },
  { value: 'vote_average.asc', label: 'Rating (Low to High)' },
  { value: 'first_air_date.desc', label: 'Air Date (Newest)' },
  { value: 'first_air_date.asc', label: 'Air Date (Oldest)' },
  { value: 'name.asc', label: 'Name (A-Z)' },
  { value: 'name.desc', label: 'Name (Z-A)' },
]

export const FilterSidebar = ({
  mediaType,
  className,
  filter,
  updateFilter,
  toggleGenre,
  clearFilters,
  hasActiveFilters,
  sections,
  toggleSection,
}: FilterSidebarProps) => {
  // Local state for filters that need save buttons
  const [localRating, setLocalRating] = React.useState<[number, number]>([
    filter.minRating || 0,
    filter.maxRating || 10,
  ])
  const [localVotes, setLocalVotes] = React.useState<number>(
    filter.minVotes || 0
  )
  const [localDates, setLocalDates] = React.useState<{
    from: string
    to: string
  }>({
    from: filter.fromDate || '',
    to: filter.toDate || '',
  })
  const [localRuntime, setLocalRuntime] = React.useState<[number, number]>([
    filter.minRuntime || 0,
    filter.maxRuntime || 300,
  ])

  // Sync local state when filter changes externally (e.g., clear filters)
  React.useEffect(() => {
    setLocalRating([filter.minRating || 0, filter.maxRating || 10])
    setLocalVotes(filter.minVotes || 0)
    setLocalDates({
      from: filter.fromDate || '',
      to: filter.toDate || '',
    })
    setLocalRuntime([filter.minRuntime || 0, filter.maxRuntime || 300])
  }, [
    filter.minRating,
    filter.maxRating,
    filter.minVotes,
    filter.fromDate,
    filter.toDate,
    filter.minRuntime,
    filter.maxRuntime,
  ])

  // Check if local changes differ from current filter
  const hasRatingChanges =
    localRating[0] !== (filter.minRating || 0) ||
    localRating[1] !== (filter.maxRating || 10)

  const hasVotesChanges = localVotes !== (filter.minVotes || 0)

  const hasDateChanges =
    localDates.from !== (filter.fromDate || '') ||
    localDates.to !== (filter.toDate || '')

  const hasRuntimeChanges =
    localRuntime[0] !== (filter.minRuntime || 0) ||
    localRuntime[1] !== (filter.maxRuntime || 300)

  // Direct handlers - immediate changes
  const handleSortChange = (value: SortOption) => {
    updateFilter({ sortBy: value })
  }

  // Save handlers for filters with save buttons
  const handleRatingSave = () => {
    const [min, max] = localRating
    updateFilter({
      minRating: min === 0 ? undefined : min,
      maxRating: max === 10 ? undefined : max,
    })
  }

  const handleVotesSave = () => {
    updateFilter({ minVotes: localVotes === 0 ? undefined : localVotes })
  }

  const handleDatesSave = () => {
    updateFilter({
      fromDate: localDates.from || undefined,
      toDate: localDates.to || undefined,
    })
  }

  const handleRuntimeSave = () => {
    const [min, max] = localRuntime
    updateFilter({
      minRuntime: min === 0 ? undefined : min,
      maxRuntime: max === 300 ? undefined : max,
    })
  }

  // Section toggle handlers
  const handleSectionToggle = (sectionName: string) => {
    toggleSection(`${sectionName}Section`)
  }

  const currentSortOptions = mediaType === 'movie' ? sortOptions : tvSortOptions
  const currentGenres = mediaType === 'movie' ? MOVIES_GENRE : TV_GENRE

  return (
    <div className={cn('w-full max-w-sm space-y-4 lg:space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icons.sliders className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear All
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="invisible" />
        )}
      </div>

      <ScrollArea className="max-h-[80vh] lg:max-h-full pb-8 lg:pb-0 overflow-y-auto">
        <div className="space-y-4 lg:space-y-6 pr-4">
          {/* Sort */}
          <FilterSection
            title="Sort By"
            isOpen={sections.sort}
            onToggle={() => handleSectionToggle('sort')}
          >
            <Select value={filter.sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sorting option" />
              </SelectTrigger>
              <SelectContent>
                {currentSortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSection>

          {/* Genres */}
          <FilterSection
            title="Genres"
            isOpen={sections.genres}
            onToggle={() => handleSectionToggle('genres')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentGenres.map((genre) => {
                const isSelected = filter.selectedGenres.includes(genre.id)
                const isExcluded = filter.excludedGenres.includes(genre.id)

                return (
                  <div key={genre.id} className="space-y-1">
                    <Button
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleGenre(genre.id, false)}
                      className={cn(
                        'w-full justify-start text-xs h-8 cursor-pointer',
                        isSelected && 'bg-primary text-primary-foreground',
                        isExcluded && 'opacity-50'
                      )}
                    >
                      {genre.name}
                    </Button>
                  </div>
                )
              })}
            </div>
            {/* {(filter.selectedGenres.length > 0 ||
              filter.excludedGenres.length > 0) && (
              <div className="mt-3">
                <Separator />
                <div className="mt-3 space-y-2">
                  {filter.selectedGenres.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Include:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {filter.selectedGenres.map((genreId) => {
                          const genre = currentGenres.find(
                            (g) => g.id === genreId
                          )
                          return (
                            <Badge
                              key={genreId}
                              variant="default"
                              className="text-xs"
                            >
                              {genre?.name}
                              <button
                                onClick={() => onToggleGenre(genreId, false)}
                                className="ml-1 hover:bg-primary/20 rounded-full"
                              >
                                <Icons.close className="h-3 w-3" />
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )} */}
          </FilterSection>

          {/* Rating */}
          <FilterSection
            title="Rating"
            isOpen={sections.rating}
            onToggle={() => handleSectionToggle('rating')}
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Rating Range</span>
                  <span>
                    {localRating[0].toFixed(1)} - {localRating[1].toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={localRating}
                  onValueChange={(values) =>
                    setLocalRating(values as [number, number])
                  }
                  min={0}
                  max={10}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>10</span>
                </div>
                {hasRatingChanges && (
                  <Button
                    size="sm"
                    onClick={handleRatingSave}
                    className="w-full h-7 text-xs"
                  >
                    Save Rating
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Minimum Votes</span>
                  <span>{localVotes}</span>
                </div>
                <Slider
                  value={[localVotes]}
                  onValueChange={(values) => setLocalVotes(values[0])}
                  min={0}
                  max={1000}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>1000+</span>
                </div>
                {hasVotesChanges && (
                  <Button
                    size="sm"
                    onClick={handleVotesSave}
                    className="w-full h-7 text-xs"
                  >
                    Save Votes
                  </Button>
                )}
              </div>
            </div>
          </FilterSection>

          {/* Date Range */}
          <FilterSection
            title={mediaType === 'movie' ? 'Release Date' : 'Air Date'}
            isOpen={sections.date}
            onToggle={() => handleSectionToggle('date')}
          >
            <div className="space-y-3">
              <DatePicker
                id="from-date"
                label="From"
                value={localDates.from}
                onStringValueChange={(value) =>
                  setLocalDates((prev) => ({ ...prev, from: value }))
                }
                mode="calendar"
                placeholder="From date"
                buttonClassName="h-8 text-sm"
              />
              <DatePicker
                id="to-date"
                label="To"
                value={localDates.to}
                onStringValueChange={(value) =>
                  setLocalDates((prev) => ({ ...prev, to: value }))
                }
                mode="calendar"
                placeholder="To date"
                buttonClassName="h-8 text-sm"
              />
              {hasDateChanges && (
                <Button
                  size="sm"
                  onClick={handleDatesSave}
                  className="w-full h-7 text-xs"
                >
                  Save Dates
                </Button>
              )}
            </div>
          </FilterSection>

          {/* Runtime (Movies only) */}
          {mediaType === 'movie' && (
            <FilterSection
              title="Runtime (minutes)"
              isOpen={sections.runtime}
              onToggle={() => handleSectionToggle('runtime')}
            >
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Runtime Range</span>
                  <span>
                    {localRuntime[0]} - {localRuntime[1]} min
                  </span>
                </div>
                <Slider
                  value={localRuntime}
                  onValueChange={(values) =>
                    setLocalRuntime(values as [number, number])
                  }
                  min={0}
                  max={300}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 min</span>
                  <span>300+ min</span>
                </div>
                {hasRuntimeChanges && (
                  <Button
                    size="sm"
                    onClick={handleRuntimeSave}
                    className="w-full h-7 text-xs"
                  >
                    Save Runtime
                  </Button>
                )}
              </div>
            </FilterSection>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
