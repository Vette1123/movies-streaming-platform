'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Clock, Film, Heart, Home, Search, Tv, X } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'

import { MediaType } from '@/types/media'
import { siteConfig } from '@/config/site'
import { SUPPORT_PRICES } from '@/config/support'
import {
  trackCommandShortcutUsed,
  trackSearchNoResults,
  trackSearchOpened,
  trackSearchPerformed,
  trackSearchResultClicked,
  trackSupportCtaClicked,
} from '@/lib/analytics'
import { searchMediaApi } from '@/lib/api-client'
import { COMPANION_APPS, openOnPlayStore } from '@/lib/apps'
import { SEARCH_DEBOUNCE } from '@/lib/constants'
import { mediaDetailHref, resolveMediaType } from '@/lib/media'
import { handleImageFallbackError } from '@/lib/tmdbConfig'
import {
  cn,
  getThumbBackdropURL,
  getThumbPosterURL,
  pluralize,
} from '@/lib/utils'
import { useAccountIdentity } from '@/hooks/use-account'
import { useCMDKListener } from '@/hooks/use-cmdk-listener'
import { useRecentSearches } from '@/hooks/use-recent-searches'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Chip, chipVariants } from '@/components/ui/chip'
import {
  CommandDialog,
  CommandDialogProps,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import { Icons } from '@/components/icons'

type SearchStatus = 'idle' | 'loading' | 'empty' | 'results'
type MediaFilter = 'all' | 'movie' | 'tv'

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Derive the search panel's status from its inputs. Kept as a flat guard chain
// (no nested ternaries) so the precedence idle→loading→empty→results is obvious.
function computeSearchStatus(
  trimmedQuery: string,
  isLoading: boolean,
  hasSearched: boolean,
  visibleCount: number
): SearchStatus {
  if (!trimmedQuery) return 'idle'
  if (isLoading) return 'loading'
  if (hasSearched && visibleCount === 0) return 'empty'
  return 'results'
}

// Heading shown above the command-menu list, per status.
function buildResultsHeading(
  status: SearchStatus,
  recentCount: number,
  resultCount: number
) {
  if (status === 'idle' && recentCount > 0) return 'Recent searches'
  if (status === 'results' && resultCount > 0) {
    return `Search Movies & Series · ${resultCount} ${pluralize(resultCount, 'result')}`
  }
  return 'Search Movies & Series...'
}

const HighlightedText = React.memo(function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}) {
  if (!text) return null
  if (!query) return <>{text}</>

  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'i'))
  const lowered = query.toLowerCase()

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lowered ? (
          <mark
            key={i}
            className="bg-primary/25 text-foreground rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  )
})

const mediaHref = (movie: MediaType) =>
  mediaDetailHref(resolveMediaType(movie), movie.id)

export function CommandMenu({ ...props }: CommandDialogProps) {
  const { open, setOpen, runCommand, isLoading, setIsLoading } =
    useCMDKListener()
  const [data, setData] = React.useState<MediaType[]>([])
  const [query, setQuery] = React.useState('')
  const [hasSearched, setHasSearched] = React.useState(false)
  const [mediaFilter, setMediaFilter] = React.useState<MediaFilter>('all')
  const { recent, add: addRecent, remove: removeRecent } = useRecentSearches()
  const router = useRouter()
  const { ready, pro } = useAccountIdentity()
  const supporter = ready && pro

  // Sequence id to drop stale responses when the user types quickly.
  const requestSeqRef = React.useRef(0)
  // Tracks last result count so skeletons match list height between queries.
  const [skeletonCount, setSkeletonCount] = React.useState(4)

  const trimmedQuery = query.trim()

  // Fire once each time the palette opens (button click or ⌘K).
  React.useEffect(() => {
    if (open) trackSearchOpened()
  }, [open])

  const runSearch = React.useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      const seq = ++requestSeqRef.current
      try {
        const res = await searchMediaApi(trimmed)
        if (seq !== requestSeqRef.current) return
        const results = res?.results ?? []
        setData(results)
        setHasSearched(true)
        const renderable = results.filter(
          (m) => m?.media_type !== ('person' as MediaType['media_type'])
        ).length
        trackSearchPerformed({ query: trimmed, results_count: renderable })
        if (renderable === 0) {
          trackSearchNoResults({ query: trimmed })
        }
        if (renderable > 0) {
          setSkeletonCount(Math.max(3, Math.min(6, renderable)))
          addRecent(trimmed)
        }
      } catch {
        if (seq !== requestSeqRef.current) return
        setData([])
        setHasSearched(true)
      } finally {
        if (seq === requestSeqRef.current) {
          setIsLoading(false)
        }
      }
    },
    [setIsLoading, addRecent]
  )

  const debouncedRunSearch = useDebouncedCallback(runSearch, SEARCH_DEBOUNCE)

  // Run a term immediately (used by recent-search chips), bypassing the debounce.
  const submitSearch = React.useCallback(
    (term: string) => {
      setQuery(term)
      if (!term.trim()) return
      setIsLoading(true)
      runSearch(term)
    },
    [runSearch, setIsLoading]
  )

  const handleValueChange = (value: string) => {
    setQuery(value)
    const trimmed = value.trim()
    if (!trimmed) {
      debouncedRunSearch.cancel()
      requestSeqRef.current++
      setData([])
      setHasSearched(false)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    debouncedRunSearch(trimmed)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      debouncedRunSearch.cancel()
      requestSeqRef.current++
      setQuery('')
      setData([])
      setHasSearched(false)
      setIsLoading(false)
      setMediaFilter('all')
    }
  }

  const visibleResults = React.useMemo(
    () =>
      (data ?? [])
        .filter(
          (movie) => movie?.media_type !== ('person' as MediaType['media_type'])
        )
        .sort((a, b) => (b?.vote_average ?? 0) - (a?.vote_average ?? 0)),
    [data]
  )

  // Counts per media type drive the filter chips; results respect the active
  // filter. `search/multi` already returns both movies and TV, so this is a
  // pure client-side narrowing with no extra request.
  const counts = React.useMemo(
    () => ({
      all: visibleResults.length,
      movie: visibleResults.filter((m) => m.media_type === 'movie').length,
      tv: visibleResults.filter((m) => m.media_type === 'tv').length,
    }),
    [visibleResults]
  )

  // If the chosen type has nothing in the current results, transparently show
  // All (derived, so no state churn when a new query changes the mix).
  const effectiveFilter: MediaFilter =
    mediaFilter !== 'all' && counts[mediaFilter] === 0 ? 'all' : mediaFilter

  const filteredResults = React.useMemo(
    () =>
      effectiveFilter === 'all'
        ? visibleResults
        : visibleResults.filter((m) => m.media_type === effectiveFilter),
    [visibleResults, effectiveFilter]
  )

  const status: SearchStatus = computeSearchStatus(
    trimmedQuery,
    isLoading,
    hasSearched,
    visibleResults.length
  )

  const resultsHeading = buildResultsHeading(
    status,
    recent.length,
    filteredResults.length
  )

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          // Widens only where there is room to spare. It used to jump to 16rem
          // at lg, which is exactly the band where the desktop nav is fighting
          // for the same pixels.
          'text-muted-foreground hover:border-primary/40 relative w-full justify-start pl-9 text-sm transition-colors sm:pr-14 md:w-44 xl:w-52 2xl:w-64'
        )}
        onClick={() => setOpen(true)}
        {...props}
      >
        <Search
          className="absolute left-3 size-4 shrink-0 opacity-60"
          aria-hidden
        />
        <span className="truncate">Search...</span>
        <kbd className="bg-background text-muted-foreground pointer-events-none absolute top-1/2 right-2 hidden h-6 -translate-y-1/2 items-center gap-1 rounded-md border px-1.5 font-mono text-[11px] font-medium shadow-sm select-none sm:flex">
          <span className="text-sm leading-none">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Type a command or search..."
          value={query}
          onValueChange={handleValueChange}
          isLoading={isLoading}
        />
        {status === 'results' && visibleResults.length > 0 && (
          <div className="flex items-center gap-1.5 border-b px-3 py-2">
            {(
              [
                ['all', 'All', counts.all],
                ['movie', 'Movies', counts.movie],
                ['tv', 'TV', counts.tv],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMediaFilter(key)}
                disabled={key !== 'all' && count === 0}
                aria-pressed={effectiveFilter === key}
                className={cn(
                  chipVariants({
                    variant: effectiveFilter === key ? 'primary' : 'neutral',
                  }),
                  'cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                  effectiveFilter !== key &&
                    'hover:border-primary/50 hover:bg-primary/10 hover:text-foreground'
                )}
              >
                {label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] tabular-nums',
                    effectiveFilter === key
                      ? 'bg-primary-foreground/20'
                      : 'bg-muted-foreground/15'
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
        <CommandList className="max-h-[75vh] min-h-0 flex-1 sm:max-h-[74vh] sm:min-h-[460px] sm:flex-none">
          <CommandGroup heading={resultsHeading}>
            {status === 'idle' &&
              (recent.length > 0 ? (
                recent.map((term) => (
                  <CommandItem
                    key={term}
                    value={`recent:${term}`}
                    onSelect={() => submitSearch(term)}
                    className="group/recent hover:bg-accent cursor-pointer"
                  >
                    <Clock
                      className="text-muted-foreground mr-2 size-4 shrink-0"
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{term}</span>
                    <button
                      type="button"
                      aria-label={`Remove “${term}” from recent searches`}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRecent(term)
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="text-muted-foreground/60 hover:text-foreground ml-2 shrink-0 cursor-pointer rounded p-0.5 opacity-0 transition group-hover/recent:opacity-100 focus-visible:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </CommandItem>
                ))
              ) : (
                <div
                  role="status"
                  className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm"
                >
                  <Search className="size-4" aria-hidden />
                  <p>Start typing to search movies & series…</p>
                </div>
              ))}

            {status === 'loading' && (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="flex flex-col gap-1 py-1"
              >
                <span className="sr-only">Searching…</span>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <Skeleton className="aspect-video h-[54px] shrink-0 rounded-md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                    <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {status === 'empty' && (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center justify-center gap-1 px-4 py-6 text-center"
              >
                <Icons.search
                  className="text-muted-foreground size-5"
                  aria-hidden
                />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-muted-foreground w-full text-xs break-words">
                  Nothing matched “{trimmedQuery}”. Try a different title.
                </p>
              </div>
            )}

            {status === 'results' &&
              filteredResults.map((movie, index) => {
                const href = mediaHref(movie)
                const year = movie?.release_date
                  ? movie.release_date.split('-')[0]
                  : null
                const rating = movie?.vote_average
                  ? movie.vote_average.toFixed(1)
                  : null
                const imdbRating = movie?.imdbRating
                const votes = movie?.vote_count
                  ? compactNumber.format(movie.vote_count)
                  : null
                const showOriginal =
                  !!movie?.original_title &&
                  movie.original_title.toLowerCase() !==
                    (movie?.title ?? '').toLowerCase()

                return (
                  <CommandItem
                    key={`${movie.media_type ?? 'movie'}-${movie.id}`}
                    value={`${movie.id}-${movie.title}`}
                    className="group/command-item hover:bg-accent cursor-pointer transition-colors duration-200"
                    onSelect={() => {
                      trackSearchResultClicked({
                        query: trimmedQuery,
                        media_id: movie.id,
                        media_type: resolveMediaType(movie),
                        title: movie.title,
                        position: index,
                      })
                      runCommand(() => router.push(href))
                    }}
                    onMouseEnter={() => router.prefetch(href)}
                    onFocus={() => router.prefetch(href)}
                  >
                    <div className="flex w-full min-w-0 flex-nowrap items-center gap-3 overflow-hidden">
                      {movie?.backdrop_path ? (
                        <div className="bg-muted ring-border/60 relative aspect-video h-[54px] shrink-0 overflow-hidden rounded-md shadow-sm ring-1">
                          <Image
                            src={getThumbBackdropURL(movie.backdrop_path)}
                            alt={movie?.title ?? ''}
                            fill
                            sizes="96px"
                            className="object-cover"
                            draggable={false}
                            unoptimized
                            onError={(e) =>
                              handleImageFallbackError(e.currentTarget)
                            }
                          />
                        </div>
                      ) : movie?.poster_path ? (
                        <div className="bg-muted ring-border/60 relative aspect-video h-[54px] shrink-0 overflow-hidden rounded-md shadow-sm ring-1">
                          <Image
                            src={getThumbPosterURL(movie.poster_path)}
                            alt={movie?.title ?? ''}
                            fill
                            sizes="96px"
                            className="object-cover object-top"
                            draggable={false}
                            unoptimized
                            onError={(e) =>
                              handleImageFallbackError(e.currentTarget)
                            }
                          />
                        </div>
                      ) : (
                        <div className="bg-muted text-muted-foreground ring-border/60 flex aspect-video h-[54px] shrink-0 items-center justify-center rounded-md shadow-sm ring-1">
                          {movie?.media_type === 'tv' ? (
                            <Tv className="size-4" aria-hidden />
                          ) : (
                            <Film className="size-4" aria-hidden />
                          )}
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="truncate text-sm font-medium">
                          <HighlightedText
                            text={movie?.title ?? ''}
                            query={trimmedQuery}
                          />
                        </p>
                        {(year || imdbRating || rating || showOriginal) && (
                          <p className="text-muted-foreground truncate text-xs">
                            {showOriginal && (
                              <span className="italic">
                                {movie.original_title}
                              </span>
                            )}
                            {showOriginal &&
                              (year || imdbRating || rating) &&
                              ' • '}
                            {year}
                            {year && (imdbRating || rating) && ' • '}
                            {imdbRating ? (
                              <>
                                <span className="rounded-[2px] bg-[#f5c518] px-1 align-middle text-[9px] font-bold text-black">
                                  IMDb
                                </span>{' '}
                                {imdbRating}
                              </>
                            ) : (
                              rating && (
                                <>
                                  {rating}★
                                  {votes && (
                                    <span className="text-muted-foreground/80">
                                      {' '}
                                      · {votes}
                                    </span>
                                  )}
                                </>
                              )
                            )}
                          </p>
                        )}
                        {movie?.overview && (
                          <p className="text-muted-foreground/90 line-clamp-2 text-xs leading-snug">
                            {movie.overview}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {movie?.media_type && (
                          <Chip
                            variant="neutral"
                            size="sm"
                            className="capitalize"
                          >
                            {movie.media_type}
                          </Chip>
                        )}
                        {movie?.adult && (
                          <Chip variant="danger" size="sm">
                            18+
                          </Chip>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                )
              })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Shortcuts...">
            <CommandItem
              className="cursor-pointer"
              onSelect={() => {
                trackCommandShortcutUsed({ shortcut: 'movies' })
                runCommand(() => router.push(`/movies`))
              }}
            >
              <Icons.playIcon className="mr-2 size-4" />
              Movies
            </CommandItem>
            <CommandItem
              className="cursor-pointer"
              onSelect={() => {
                trackCommandShortcutUsed({ shortcut: 'series' })
                runCommand(() => router.push(`/tv-shows`))
              }}
            >
              <Tv className="mr-2 size-4" />
              Series
            </CommandItem>
            <CommandItem
              className="cursor-pointer"
              onSelect={() => {
                trackCommandShortcutUsed({ shortcut: 'home' })
                runCommand(() => router.push(`/`))
              }}
            >
              <Home className="mr-2 size-4" />
              Home
            </CommandItem>
            {/* The palette is the fastest route to anywhere on this site for
                the people who use it most, which makes it the one place the
                plans should not be missing from. Supporters get the same row
                pointing at the same page, worded as their plan rather than a
                pitch — see FooterSupportCard for the rest of that promise. */}
            <CommandItem
              className="cursor-pointer"
              onSelect={() => {
                if (!supporter)
                  trackSupportCtaClicked({ surface: 'command_menu' })
                runCommand(() => router.push(`/support`))
              }}
            >
              <Heart className="mr-2 size-4" />
              <div className="flex flex-col">
                <span>{supporter ? 'Your plan' : 'Support Reely'}</span>
                <span className="text-muted-foreground text-xs">
                  {supporter
                    ? 'Manage or change your supporter membership'
                    : `From $${SUPPORT_PRICES.monthly} a month · keeps the site free`}
                </span>
              </div>
            </CommandItem>
            <CommandItem
              className="cursor-pointer"
              onSelect={() => {
                trackCommandShortcutUsed({ shortcut: 'portfolio' })
                runCommand(() =>
                  window.open(siteConfig.author.website, '_blank')
                )
              }}
            >
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src="/personal-logo.png" />
                  <AvatarFallback>G</AvatarFallback>
                </Avatar>
                Portfolio
              </div>
            </CommandItem>
            {COMPANION_APPS.map((app) => (
              <CommandItem
                key={app.slug}
                className="cursor-pointer"
                onSelect={() => {
                  trackCommandShortcutUsed({ shortcut: app.slug })
                  runCommand(() => openOnPlayStore(app))
                }}
              >
                <div className="flex items-center gap-4">
                  <Icons.googlePlay className="size-5" />
                  <div className="flex flex-col">
                    <span>{app.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {app.tagline} · Google Play
                    </span>
                  </div>
                </div>
              </CommandItem>
            ))}
            <CommandItem
              className="cursor-pointer"
              onSelect={() => {
                trackCommandShortcutUsed({ shortcut: 'buy_me_a_coffee' })
                runCommand(() =>
                  window.open(`https://buymeacoffee.com/vetteotp`, '_blank')
                )
              }}
            >
              <div className="flex items-center gap-4">
                <Icons.buyMeACoffee className="size-5" />
                Buy me a coffee
              </div>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
        <div
          className="text-muted-foreground bg-muted/30 hidden items-center justify-between gap-2 border-t px-3 py-2 text-[11px] sm:flex"
          aria-hidden
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="bg-background rounded border px-1 font-mono">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-background rounded border px-1 font-mono">
                ↵
              </kbd>
              open
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="bg-background rounded border px-1 font-mono">
              esc
            </kbd>
            close
          </span>
        </div>
      </CommandDialog>
    </>
  )
}
