'use client'

import React from 'react'
import { cva } from 'class-variance-authority'
import {
  ArrowUpDown,
  CalendarRange,
  Check,
  ChevronDown,
  Clock,
  Languages as LanguagesIcon,
  Minus,
  MonitorPlay,
  ShieldCheck,
  Star,
  Tags,
} from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'

import { MediaFilter, SortOption } from '@/types/filter'
import {
  DECADES,
  LANGUAGES,
  MIN_YEAR,
  MOVIE_CERTIFICATIONS,
  WATCH_REGIONS,
} from '@/lib/filter-options'
import { cn } from '@/lib/utils'
import { useGenres } from '@/hooks/use-genres'
import { useWatchProviders } from '@/hooks/use-watch-providers'
import { Button } from '@/components/ui/button'
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
import { CountBadge } from '@/components/media/filter-controls'
import { SavedFilters } from '@/components/media/saved-filters'

interface FilterSidebarProps {
  mediaType: 'movie' | 'tv'
  className?: string
  filter: MediaFilter
  updateFilter: (updates: Partial<MediaFilter>) => void
  cycleGenre: (genreId: number) => void
  clearFilters: () => void
  hasActiveFilters: boolean
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'popularity.desc', label: 'Most popular' },
  { value: 'popularity.asc', label: 'Least popular' },
  { value: 'vote_average.desc', label: 'Highest rated' },
  { value: 'vote_average.asc', label: 'Lowest rated' },
  { value: 'vote_count.desc', label: 'Most voted' },
  { value: 'revenue.desc', label: 'Highest grossing' },
  { value: 'release_date.desc', label: 'Newest first' },
  { value: 'release_date.asc', label: 'Oldest first' },
  { value: 'original_title.asc', label: 'Title (A-Z)' },
]

const tvSortOptions: { value: SortOption; label: string }[] = [
  { value: 'popularity.desc', label: 'Most popular' },
  { value: 'popularity.asc', label: 'Least popular' },
  { value: 'vote_average.desc', label: 'Highest rated' },
  { value: 'vote_average.asc', label: 'Lowest rated' },
  { value: 'vote_count.desc', label: 'Most voted' },
  { value: 'first_air_date.desc', label: 'Newest first' },
  { value: 'first_air_date.asc', label: 'Oldest first' },
  { value: 'name.asc', label: 'Name (A-Z)' },
]

const ANY_LANGUAGE = 'any'
const PROVIDER_LOGO_BASE = 'https://image.tmdb.org/t/p/w92'
// Cap the provider grid to the top of TMDB's priority-ordered roster: the big
// services people actually filter by, without firing 100+ logo requests.
const MAX_PROVIDERS = 32

// One source of truth for the three toggle groups (genres / decades / age
// ratings) that all shared the same idle+hover surface and primary "active"
// fill via hand-copied class strings. `pill` is the rounded genre/decade chip;
// `square` is the rounded-md certification chip. `excluded` is genre-only.
const filterToggleVariants = cva(
  'border px-3 py-1.5 motion-reduce:transition-none',
  {
    variants: {
      shape: {
        pill: 'rounded-full text-xs font-medium transition duration-200',
        square: 'rounded-md text-xs font-semibold transition-colors',
      },
      state: {
        idle: 'border-white/12 bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary hover:bg-primary-fill hover:text-primary-foreground hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.6)]',
        active:
          'border-primary bg-primary-fill text-primary-foreground hover:border-primary hover:text-primary-foreground',
        excluded:
          'border-destructive/50 bg-destructive/10 text-destructive hover:text-destructive line-through',
      },
    },
    defaultVariants: { shape: 'pill', state: 'idle' },
  }
)

// Tri-state genre toggle: included → excluded → off. Kept as a helper so the
// call site stays a single expression (no nested ternary).
const genreToggleState = (
  included: boolean,
  excluded: boolean
): 'active' | 'excluded' | 'idle' => {
  if (included) return 'active'
  if (excluded) return 'excluded'
  return 'idle'
}

interface SectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  isOpen: boolean
  onToggle: () => void
  count?: number
  children: React.ReactNode
}

const Section = ({
  title,
  icon: SectionIcon,
  isOpen,
  onToggle,
  count,
  children,
}: SectionProps) => (
  <div className="border-border/40 border-b pb-4 last:border-b-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="text-foreground group flex w-full items-center justify-between py-1 text-sm font-medium"
    >
      <span className="flex items-center gap-2.5">
        <SectionIcon className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
        {title}
        <CountBadge count={count} tone="soft" />
      </span>
      <ChevronDown
        className={cn(
          'text-muted-foreground h-4 w-4 transition-transform duration-200 motion-reduce:transition-none',
          isOpen && 'rotate-180'
        )}
      />
    </button>
    {isOpen && <div className="mt-4 space-y-4">{children}</div>}
  </div>
)

export const FilterSidebar = ({
  mediaType,
  className,
  filter,
  updateFilter,
  cycleGenre,
  clearFilters,
  hasActiveFilters,
}: FilterSidebarProps) => {
  const isMovie = mediaType === 'movie'
  const currentYear = new Date().getFullYear()
  const genres = useGenres(mediaType)
  const providers = useWatchProviders(mediaType, filter.watchRegion)

  // Accordion state is LOCAL now (was URL-synced) so shareable filter links carry
  // only real filters. Genres open by default — the most-used control.
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    sort: true,
    genres: true,
    year: false,
    rating: false,
    runtime: false,
    language: false,
    certification: false,
    providers: false,
  })
  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))

  // Local mirror of the sliders for smooth dragging; the committed value is
  // pushed to the URL on a debounce (live-apply — no more "Save" buttons).
  const [localRating, setLocalRating] = React.useState<[number, number]>([
    filter.minRating || 0,
    filter.maxRating || 10,
  ])
  const [localVotes, setLocalVotes] = React.useState(filter.minVotes || 0)
  const [localRuntime, setLocalRuntime] = React.useState<[number, number]>([
    filter.minRuntime || 0,
    filter.maxRuntime || 300,
  ])
  const yearFrom = filter.fromDate
    ? Number(filter.fromDate.slice(0, 4))
    : MIN_YEAR
  const yearTo = filter.toDate ? Number(filter.toDate.slice(0, 4)) : currentYear
  const [localYears, setLocalYears] = React.useState<[number, number]>([
    yearFrom,
    yearTo,
  ])

  // Re-sync local mirrors when the committed filter changes from the outside
  // (Clear all, an active-chip removal, back/forward). Without this the sliders
  // would keep showing a stale dragged value after a reset.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setLocalRating([filter.minRating || 0, filter.maxRating || 10])
    setLocalVotes(filter.minVotes || 0)
    setLocalRuntime([filter.minRuntime || 0, filter.maxRuntime || 300])
    setLocalYears([
      filter.fromDate ? Number(filter.fromDate.slice(0, 4)) : MIN_YEAR,
      filter.toDate ? Number(filter.toDate.slice(0, 4)) : currentYear,
    ])
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    filter.minRating,
    filter.maxRating,
    filter.minVotes,
    filter.minRuntime,
    filter.maxRuntime,
    filter.fromDate,
    filter.toDate,
    currentYear,
  ])

  const pushRating = useDebouncedCallback((v: [number, number]) => {
    updateFilter({
      minRating: v[0] === 0 ? undefined : v[0],
      maxRating: v[1] === 10 ? undefined : v[1],
    })
  }, 300)

  const pushVotes = useDebouncedCallback((v: number) => {
    updateFilter({ minVotes: v === 0 ? undefined : v })
  }, 300)

  const pushRuntime = useDebouncedCallback((v: [number, number]) => {
    updateFilter({
      minRuntime: v[0] === 0 ? undefined : v[0],
      maxRuntime: v[1] === 300 ? undefined : v[1],
    })
  }, 300)

  const pushYears = useDebouncedCallback((v: [number, number]) => {
    const [from, to] = v
    updateFilter({
      fromDate: from <= MIN_YEAR ? undefined : `${from}-01-01`,
      toDate: to >= currentYear ? undefined : `${to}-12-31`,
    })
  }, 350)

  const applyDecade = (from: number, to: number) => {
    const resolvedTo = to >= 9999 ? currentYear : to
    setLocalYears([from, resolvedTo])
    updateFilter({
      fromDate: from <= MIN_YEAR ? undefined : `${from}-01-01`,
      toDate: resolvedTo >= currentYear ? undefined : `${resolvedTo}-12-31`,
    })
  }

  const isDecadeActive = (from: number, to: number) => {
    const resolvedTo = to >= 9999 ? currentYear : to
    return yearFrom === from && yearTo === resolvedTo
  }

  const currentSortOptions = isMovie ? sortOptions : tvSortOptions

  // Per-section active counts driving the little header badges.
  const genreCount = filter.selectedGenres.length + filter.excludedGenres.length
  const ratingCount =
    (filter.minRating || 0) > 0 || (filter.maxRating ?? 10) < 10 ? 1 : 0
  const votesCount = (filter.minVotes || 0) > 0 ? 1 : 0
  const yearCount = filter.fromDate || filter.toDate ? 1 : 0
  const runtimeCount =
    (filter.minRuntime || 0) > 0 || (filter.maxRuntime ?? 300) < 300 ? 1 : 0

  return (
    <div className={cn('w-full max-w-sm', className)}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icons.sliders className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Above the scroll area, not inside it: the saved set is what somebody
          opens this panel to reach, and burying it under nine accordions would
          make it the one control you have to scroll to find. */}
      <SavedFilters hasActiveFilters={hasActiveFilters} />

      <ScrollArea className="max-h-[78vh] overflow-y-auto pb-8 lg:max-h-[calc(100vh-8rem)] lg:pb-0">
        <div className="space-y-4 pr-3">
          {/* Sort */}
          <Section
            title="Sort by"
            icon={ArrowUpDown}
            isOpen={open.sort}
            onToggle={() => toggle('sort')}
          >
            <Select
              value={filter.sortBy}
              onValueChange={(v) => updateFilter({ sortBy: v as SortOption })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentSortOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>

          {/* Genres — tri-state */}
          <Section
            title="Genres"
            icon={Tags}
            isOpen={open.genres}
            onToggle={() => toggle('genres')}
            count={genreCount}
          >
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => {
                const included = filter.selectedGenres.includes(genre.id)
                const excluded = filter.excludedGenres.includes(genre.id)
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => cycleGenre(genre.id)}
                    className={cn(
                      filterToggleVariants({
                        state: genreToggleState(included, excluded),
                      }),
                      'flex items-center gap-1'
                    )}
                    aria-pressed={included || excluded}
                  >
                    {included && <Check className="h-3 w-3" />}
                    {excluded && <Minus className="h-3 w-3" />}
                    {genre.name}
                  </button>
                )
              })}
            </div>
            <p className="text-muted-foreground/70 text-[11px] leading-relaxed">
              Tap to include, tap again to exclude.
            </p>
          </Section>

          {/* Year */}
          <Section
            title="Year"
            icon={CalendarRange}
            isOpen={open.year}
            onToggle={() => toggle('year')}
            count={yearCount}
          >
            <div className="flex flex-wrap gap-2">
              {DECADES.map((d) => {
                const active = isDecadeActive(d.from, d.to)
                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() =>
                      active
                        ? updateFilter({
                            fromDate: undefined,
                            toDate: undefined,
                          })
                        : applyDecade(d.from, d.to)
                    }
                    className={filterToggleVariants({
                      state: active ? 'active' : 'idle',
                    })}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
            <div className="space-y-3 pt-1">
              <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
                <span>From {localYears[0]}</span>
                <span>To {localYears[1]}</span>
              </div>
              <Slider
                value={localYears}
                onValueChange={(v) => {
                  setLocalYears(v as [number, number])
                  pushYears(v as [number, number])
                }}
                min={MIN_YEAR}
                max={currentYear}
                step={1}
                className="w-full"
              />
            </div>
          </Section>

          {/* Rating */}
          <Section
            title="Rating"
            icon={Star}
            isOpen={open.rating}
            onToggle={() => toggle('rating')}
            count={ratingCount + votesCount}
          >
            <div className="space-y-3">
              <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
                <span>Score</span>
                <span>
                  {localRating[0].toFixed(1)} - {localRating[1].toFixed(1)}
                </span>
              </div>
              <Slider
                value={localRating}
                onValueChange={(v) => {
                  setLocalRating(v as [number, number])
                  pushRating(v as [number, number])
                }}
                min={0}
                max={10}
                step={0.5}
                className="w-full"
              />
            </div>
            <div className="space-y-3">
              <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
                <span>Min votes</span>
                <span>{localVotes >= 1000 ? '1000+' : localVotes}</span>
              </div>
              <Slider
                value={[localVotes]}
                onValueChange={(v) => {
                  setLocalVotes(v[0])
                  pushVotes(v[0])
                }}
                min={0}
                max={1000}
                step={50}
                className="w-full"
              />
            </div>
          </Section>

          {/* Runtime (movies only) */}
          {isMovie && (
            <Section
              title="Runtime"
              icon={Clock}
              isOpen={open.runtime}
              onToggle={() => toggle('runtime')}
              count={runtimeCount}
            >
              <div className="space-y-3">
                <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
                  <span>Length</span>
                  <span>
                    {localRuntime[0]} -{' '}
                    {localRuntime[1] >= 300 ? '300+' : localRuntime[1]} min
                  </span>
                </div>
                <Slider
                  value={localRuntime}
                  onValueChange={(v) => {
                    setLocalRuntime(v as [number, number])
                    pushRuntime(v as [number, number])
                  }}
                  min={0}
                  max={300}
                  step={5}
                  className="w-full"
                />
              </div>
            </Section>
          )}

          {/* Language */}
          <Section
            title="Language"
            icon={LanguagesIcon}
            isOpen={open.language}
            onToggle={() => toggle('language')}
            count={filter.originalLanguage ? 1 : 0}
          >
            <Select
              value={filter.originalLanguage || ANY_LANGUAGE}
              onValueChange={(v) =>
                updateFilter({
                  originalLanguage: v === ANY_LANGUAGE ? undefined : v,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_LANGUAGE}>Any language</SelectItem>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>

          {/* Age rating (movies only) */}
          {isMovie && (
            <Section
              title="Age rating"
              icon={ShieldCheck}
              isOpen={open.certification}
              onToggle={() => toggle('certification')}
              count={filter.certification ? 1 : 0}
            >
              <div className="flex flex-wrap gap-2">
                {MOVIE_CERTIFICATIONS.map((c) => {
                  const active = filter.certification === c.value
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() =>
                        updateFilter({
                          certification: active ? undefined : c.value,
                        })
                      }
                      className={filterToggleVariants({
                        shape: 'square',
                        state: active ? 'active' : 'idle',
                      })}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Where to watch */}
          <Section
            title="Where to watch"
            icon={MonitorPlay}
            isOpen={open.providers}
            onToggle={() => toggle('providers')}
            count={filter.watchProviders.length}
          >
            <Select
              value={filter.watchRegion}
              onValueChange={(v) =>
                // Roster differs per region — reset picks so a stale id can't
                // silently filter against the wrong regional catalog.
                updateFilter({ watchRegion: v, watchProviders: [] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WATCH_REGIONS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {providers.length === 0 ? (
              <p className="text-muted-foreground/70 text-[11px]">
                No providers listed for this region.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {providers.slice(0, MAX_PROVIDERS).map((p) => {
                  const active = filter.watchProviders.includes(p.provider_id)
                  return (
                    <button
                      key={p.provider_id}
                      type="button"
                      title={p.provider_name}
                      onClick={() =>
                        updateFilter({
                          watchProviders: active
                            ? filter.watchProviders.filter(
                                (id) => id !== p.provider_id
                              )
                            : [...filter.watchProviders, p.provider_id],
                        })
                      }
                      className={cn(
                        'relative aspect-square overflow-hidden rounded-lg border-2 bg-white/95 transition motion-reduce:transition-none',
                        active
                          ? 'border-primary ring-primary/30 ring-2'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      )}
                    >
                      {/* Plain <img>, not next/image: keyless TMDB origin, no
                          domain config, and these are tiny cached logos. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${PROVIDER_LOGO_BASE}${p.logo_path}`}
                        alt={p.provider_name}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-contain"
                      />
                      {active && (
                        <span className="bg-primary-fill text-primary-foreground absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      </ScrollArea>
    </div>
  )
}
