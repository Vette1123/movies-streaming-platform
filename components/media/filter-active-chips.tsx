'use client'

import React from 'react'
import { X } from 'lucide-react'

import { MediaFilter } from '@/types/filter'
import { languageName } from '@/lib/filter-options'
import { cn } from '@/lib/utils'
import { useGenres } from '@/hooks/use-genres'
import { useWatchProviders } from '@/hooks/use-watch-providers'

interface FilterActiveChipsProps {
  mediaType: 'movie' | 'tv'
  filter: MediaFilter
  updateFilter: (updates: Partial<MediaFilter>) => void
  clearFilters: () => void
  className?: string
}

interface Chip {
  key: string
  label: string
  onRemove: () => void
}

const yearLabel = (from?: string, to?: string): string => {
  const f = from ? from.slice(0, 4) : ''
  const t = to ? to.slice(0, 4) : ''
  if (f && t) return `${f} - ${t}`
  if (f) return `${f} & newer`
  return `Up to ${t}`
}

const ratingLabel = (min?: number, max?: number): string => {
  const hasMin = (min ?? 0) > 0
  const hasMax = (max ?? 10) < 10
  if (hasMin && hasMax) return `Rating ${min?.toFixed(1)} - ${max?.toFixed(1)}`
  if (hasMin) return `Rating ${min?.toFixed(1)}+`
  return `Rating up to ${max?.toFixed(1)}`
}

const runtimeLabel = (min?: number, max?: number): string => {
  const hasMin = (min ?? 0) > 0
  const hasMax = (max ?? 300) < 300
  if (hasMin && hasMax) return `${min} - ${max} min`
  if (hasMin) return `${min}+ min`
  return `Up to ${max} min`
}

export const FilterActiveChips = ({
  mediaType,
  filter,
  updateFilter,
  clearFilters,
  className,
}: FilterActiveChipsProps) => {
  const genres = useGenres(mediaType)
  const providers = useWatchProviders(mediaType, filter.watchRegion)

  const chips = React.useMemo<Chip[]>(() => {
    const list: Chip[] = []
    const genreName = (id: number) =>
      genres.find((g) => g.id === id)?.name ?? `Genre ${id}`
    const providerName = (id: number) =>
      providers.find((p) => p.provider_id === id)?.provider_name ??
      `Provider ${id}`

    filter.selectedGenres.forEach((id) =>
      list.push({
        key: `g-${id}`,
        label: genreName(id),
        onRemove: () =>
          updateFilter({
            selectedGenres: filter.selectedGenres.filter((x) => x !== id),
          }),
      })
    )

    filter.excludedGenres.forEach((id) =>
      list.push({
        key: `x-${id}`,
        label: `Not ${genreName(id)}`,
        onRemove: () =>
          updateFilter({
            excludedGenres: filter.excludedGenres.filter((x) => x !== id),
          }),
      })
    )

    if (filter.fromDate || filter.toDate) {
      list.push({
        key: 'year',
        label: yearLabel(filter.fromDate, filter.toDate),
        onRemove: () =>
          updateFilter({ fromDate: undefined, toDate: undefined }),
      })
    }

    if ((filter.minRating ?? 0) > 0 || (filter.maxRating ?? 10) < 10) {
      list.push({
        key: 'rating',
        label: ratingLabel(filter.minRating, filter.maxRating),
        onRemove: () =>
          updateFilter({ minRating: undefined, maxRating: undefined }),
      })
    }

    if ((filter.minVotes ?? 0) > 0) {
      list.push({
        key: 'votes',
        label: `${filter.minVotes}+ votes`,
        onRemove: () => updateFilter({ minVotes: undefined }),
      })
    }

    if ((filter.minRuntime ?? 0) > 0 || (filter.maxRuntime ?? 300) < 300) {
      list.push({
        key: 'runtime',
        label: runtimeLabel(filter.minRuntime, filter.maxRuntime),
        onRemove: () =>
          updateFilter({ minRuntime: undefined, maxRuntime: undefined }),
      })
    }

    if (filter.originalLanguage) {
      list.push({
        key: 'lang',
        label: languageName(filter.originalLanguage),
        onRemove: () => updateFilter({ originalLanguage: undefined }),
      })
    }

    if (filter.certification) {
      list.push({
        key: 'cert',
        label: `Rated ${filter.certification}`,
        onRemove: () => updateFilter({ certification: undefined }),
      })
    }

    filter.watchProviders.forEach((id) =>
      list.push({
        key: `p-${id}`,
        label: providerName(id),
        onRemove: () =>
          updateFilter({
            watchProviders: filter.watchProviders.filter((x) => x !== id),
          }),
      })
    )

    return list
    // genreName/providerName read `genres`/`providers`; list rebuilds when those
    // resolve so a chip's name upgrades from the id fallback to the real label.
  }, [filter, genres, providers, updateFilter])

  if (chips.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="group border-white/12 bg-secondary text-secondary-foreground hover:border-destructive/60 hover:bg-destructive/15 hover:text-destructive flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 text-xs font-medium shadow-sm transition duration-200 motion-reduce:transition-none"
        >
          {chip.label}
          <span className="text-muted-foreground group-hover:bg-foreground/10 group-hover:text-foreground flex h-4 w-4 items-center justify-center rounded-full transition-colors">
            <X className="h-3 w-3" />
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={clearFilters}
        className="text-muted-foreground hover:text-foreground px-2 py-1 text-xs font-medium underline-offset-2 hover:underline"
      >
        Clear all
      </button>
    </div>
  )
}
