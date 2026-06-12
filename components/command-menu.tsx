'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { searchMovieAction } from '@/actions/search'
import { Home, Search, Tv } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'

import { MediaType } from '@/types/media'
import { siteConfig } from '@/config/site'
import { SEARCH_DEBOUNCE } from '@/lib/constants'
import { cn, getPosterImageURL } from '@/lib/utils'
import { useCMDKListener } from '@/hooks/use-cmdk-listener'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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

import { Badge } from './ui/badge'

type SearchStatus = 'idle' | 'loading' | 'empty' | 'results'

const handleUniqueTitle = (movie: MediaType, isDuplicate: boolean) => {
  if (!isDuplicate) return movie.title

  const parts: string[] = []

  if (movie.release_date) {
    const year = movie.release_date.split('-')[0]
    parts.push(year)
  }

  if (movie.media_type) {
    parts.push(movie.media_type)
  }

  if (movie.vote_average) {
    parts.push(`${movie.vote_average.toFixed(1)}★`)
  }

  if (parts.length > 0) {
    return `${movie.title} (${parts.join(' • ')})`
  }

  return movie.title
}

export function CommandMenu({ ...props }: CommandDialogProps) {
  const { open, setOpen, runCommand, isLoading, setIsLoading } =
    useCMDKListener()
  const [data, setData] = React.useState<MediaType[]>([])
  const [query, setQuery] = React.useState('')
  const [hasSearched, setHasSearched] = React.useState(false)
  const router = useRouter()

  // Sequence id to drop stale responses when the user types quickly.
  const requestSeqRef = React.useRef(0)

  const trimmedQuery = query.trim()

  const runSearch = React.useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      const seq = ++requestSeqRef.current
      try {
        const res = await searchMovieAction({ query: trimmed })
        if (seq !== requestSeqRef.current) return
        setData(res?.results ?? [])
        setHasSearched(true)
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
    [setIsLoading]
  )

  const debouncedRunSearch = useDebouncedCallback(runSearch, SEARCH_DEBOUNCE)

  const handleValueChange = (value: string) => {
    setQuery(value)
    const trimmed = value.trim()
    if (!trimmed) {
      // Cancel any pending search and reset to idle.
      debouncedRunSearch.cancel()
      requestSeqRef.current++
      setData([])
      setHasSearched(false)
      setIsLoading(false)
      return
    }
    // Show loading immediately for tighter feedback, even before the debounce fires.
    setIsLoading(true)
    debouncedRunSearch(trimmed)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Reset everything when the dialog closes so reopening is clean.
      debouncedRunSearch.cancel()
      requestSeqRef.current++
      setQuery('')
      setData([])
      setHasSearched(false)
      setIsLoading(false)
    }
  }

  const deduplicatedData: MediaType[] = React.useMemo(() => {
    if (!data?.length) return []

    const titleCounts: Record<string, number> = {}
    data.forEach((movie) => {
      if (movie?.title) {
        const lowercaseTitle = movie.title.toLowerCase()
        titleCounts[lowercaseTitle] = (titleCounts[lowercaseTitle] || 0) + 1
      }
    })

    const processedData = data.map((movie) => {
      if (!movie?.title) return movie

      const lowercaseTitle = movie.title.toLowerCase()
      const isDuplicate = titleCounts[lowercaseTitle] > 1
      const uniqueTitle = handleUniqueTitle(movie, isDuplicate)

      return { ...movie, title: uniqueTitle }
    })

    return processedData.sort((a, b) => {
      const voteA = a.vote_average || 0
      const voteB = b.vote_average || 0
      return voteB - voteA
    })
  }, [data])

  const visibleResults = React.useMemo(
    () => deduplicatedData.filter((movie) => movie?.poster_path),
    [deduplicatedData]
  )

  const status: SearchStatus = !trimmedQuery
    ? 'idle'
    : isLoading
      ? 'loading'
      : hasSearched && visibleResults.length === 0
        ? 'empty'
        : 'results'

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          'text-muted-foreground relative w-full justify-start text-sm sm:pr-12 md:w-40 lg:w-64'
        )}
        onClick={() => setOpen(true)}
        {...props}
      >
        <span className="inline-flex">Search...</span>
        <kbd className="bg-muted pointer-events-none absolute top-2 right-2 hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex">
          <span className="text-xs">⌘</span>K
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
        <CommandList>
          <CommandGroup heading="Search Movies & Series...">
            {status === 'idle' && (
              <div
                role="status"
                className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm"
              >
                <Search className="size-4" aria-hidden />
                <p>Start typing to search movies & series…</p>
              </div>
            )}

            {status === 'loading' && (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="flex flex-col gap-1 py-1"
              >
                <span className="sr-only">Searching…</span>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2 py-2"
                  >
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
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
                className="flex flex-col items-center justify-center gap-1 py-6 text-center"
              >
                <Icons.search
                  className="text-muted-foreground size-5"
                  aria-hidden
                />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-muted-foreground max-w-[260px] truncate text-xs">
                  Nothing matched “{trimmedQuery}”. Try a different title.
                </p>
              </div>
            )}

            {status === 'results' &&
              visibleResults.map((movie) => (
                <CommandItem
                  key={movie.id}
                  value={`${movie.id}-${movie.title}`}
                  className="group/command-item hover:bg-primary-foreground/50 cursor-pointer transition-colors duration-200"
                  onSelect={() => {
                    runCommand(() => {
                      if (movie?.media_type && movie?.media_type === 'tv') {
                        router.push(`/tv-shows/${movie.id}`)
                        return
                      }
                      router.push(`/movies/${movie.id}`)
                    })
                  }}
                >
                  <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage
                        src={`${getPosterImageURL(movie.poster_path)}`}
                      />
                      <AvatarFallback>G</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-sm font-medium">
                        {movie?.title}
                      </p>
                      {(movie?.release_date || movie?.vote_average) && (
                        <p className="text-muted-foreground truncate text-xs">
                          {movie?.release_date &&
                            movie.release_date.split('-')[0]}
                          {movie?.release_date && movie?.vote_average
                            ? ' • '
                            : ''}
                          {movie?.vote_average
                            ? `${movie.vote_average.toFixed(1)}★`
                            : ''}
                        </p>
                      )}
                    </div>
                    {movie?.media_type && (
                      <Badge
                        variant="outline"
                        className="bg-primary-foreground/70 shrink-0 text-xs capitalize"
                      >
                        {movie.media_type}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              ))}

          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Shortcuts...">
            <CommandItem
              className="cursor-pointer"
              onSelect={() => runCommand(() => router.push(`/movies`))}
            >
              <Icons.playIcon className="mr-2 size-4" />
              Movies
            </CommandItem>
            <CommandItem
              className="cursor-pointer"
              onSelect={() => runCommand(() => router.push(`/tv-shows`))}
            >
              <Tv className="mr-2 size-4" />
              Series
            </CommandItem>
            <CommandItem
              className="cursor-pointer"
              onSelect={() => runCommand(() => router.push(`/`))}
            >
              <Home className="mr-2 size-4" />
              Home
            </CommandItem>
            <CommandItem
              className="cursor-pointer"
              onSelect={() =>
                runCommand(() =>
                  window.open(siteConfig.author.website, '_blank')
                )
              }
            >
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src="/personal-logo.png" />
                  <AvatarFallback>G</AvatarFallback>
                </Avatar>
                Portfolio
              </div>
            </CommandItem>
            <CommandItem
              className="cursor-pointer"
              onSelect={() =>
                runCommand(() =>
                  window.open(`https://buymeacoffee.com/vetteotp`, '_blank')
                )
              }
            >
              <div className="flex items-center gap-4">
                <Icons.buyMeACoffee className="size-5" />
                Buy me a coffee
              </div>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </CommandDialog>
    </>
  )
}
