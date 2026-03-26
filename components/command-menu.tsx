'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { searchMovieAction } from '@/actions/search'
import { Bookmark, Clock, Home, Tv } from 'lucide-react'
import posthog from 'posthog-js'
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
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Icons } from '@/components/icons'

import { Badge } from './ui/badge'

const handleUniqueTitle = (movie: MediaType, isDuplicate: boolean) => {
  if (!isDuplicate) return movie.title

  // Build a comprehensive suffix with more differentiating info
  const parts: string[] = []

  // Add year if available
  if (movie.release_date) {
    const year = movie.release_date.split('-')[0]
    parts.push(year)
  }

  // Add media type if available
  if (movie.media_type) {
    parts.push(movie.media_type)
  }

  // Add rating if available (rounded to 1 decimal place)
  if (movie.vote_average) {
    parts.push(`${movie.vote_average.toFixed(1)}★`)
  }

  // If we have any differentiating info, add it
  if (parts.length > 0) {
    return `${movie.title} (${parts.join(' • ')})`
  }

  // Fallback if no extra info is available
  return movie.title
}

export function CommandMenu({ ...props }: CommandDialogProps) {
  const { open, setOpen, runCommand, isLoading, setIsLoading } =
    useCMDKListener()
  const [data, setData] = React.useState<MediaType[]>([])
  const [recentSearches, setRecentSearches] = React.useState<string[]>([])
  const router = useRouter()

  React.useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem('recentSearches')
        if (stored) setRecentSearches(JSON.parse(stored))
      } catch {}
    }
  }, [open])

  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(
      0,
      5
    )
    setRecentSearches(updated)
    try {
      localStorage.setItem('recentSearches', JSON.stringify(updated))
    } catch {}
  }

  const getMovieResults = async (value: string) => {
    if (!value) return
    setIsLoading(true)
    posthog.capture('searched', { query: value })
    const data = await searchMovieAction({ query: value })
    if (data?.results?.length) {
      setData(data?.results)
    }
    setIsLoading(false)
  }

  const debouncedGetMovieResults = useDebouncedCallback(
    getMovieResults,
    SEARCH_DEBOUNCE
  )

  const deduplicatedData: MediaType[] = React.useMemo(() => {
    if (!data?.length) return []

    // First, build a map of titles and count occurrences
    const titleCounts: Record<string, number> = {}
    data.forEach((movie) => {
      if (movie?.title) {
        const lowercaseTitle = movie.title.toLowerCase()
        titleCounts[lowercaseTitle] = (titleCounts[lowercaseTitle] || 0) + 1
      }
    })

    // Process each movie with the knowledge of which titles have duplicates
    const processedData = data.map((movie) => {
      if (!movie?.title) return movie

      const lowercaseTitle = movie.title.toLowerCase()
      const isDuplicate = titleCounts[lowercaseTitle] > 1
      const uniqueTitle = handleUniqueTitle(movie, isDuplicate)

      return { ...movie, title: uniqueTitle }
    })

    // Sort by vote_average in descending order (highest votes first)
    return processedData.sort((a, b) => {
      // Fallback to 0 if vote_average is undefined
      const voteA = a.vote_average || 0
      const voteB = b.vote_average || 0
      return voteB - voteA
    })
  }, [data])

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          'relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64'
        )}
        onClick={() => setOpen(true)}
        {...props}
      >
        <span className="inline-flex">Search...</span>
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Type a command or search..."
          onValueChange={debouncedGetMovieResults}
          isLoading={isLoading}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {recentSearches.length > 0 && !deduplicatedData.length && (
            <>
              <CommandGroup heading="Recent Searches">
                {recentSearches.map((search) => (
                  <CommandItem
                    key={search}
                    value={search}
                    className="cursor-pointer"
                    onSelect={() => {
                      runCommand(() => {
                        router.push(`/movies?query=${encodeURIComponent(search)}`)
                      })
                    }}
                  >
                    <Icons.search className="mr-2 size-4 opacity-60" />
                    {search}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          <CommandGroup heading="Search Movies & Series...">
            {deduplicatedData?.map(
              (movie) =>
                movie?.poster_path && (
                  <CommandItem
                    key={movie.id}
                    value={movie?.title}
                    className="group/command-item cursor-pointer transition-colors duration-200 hover:bg-primary-foreground/50"
                    onSelect={() => {
                      runCommand(() => {
                        saveRecentSearch(movie.title)
                        if (movie?.media_type && movie?.media_type === 'tv') {
                          router.push(`/tv-shows/${movie.id}`)
                          return
                        }
                        router.push(`/movies/${movie.id}`)
                      })
                    }}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar>
                          <AvatarImage
                            src={`${getPosterImageURL(movie.poster_path)}`}
                          />
                          <AvatarFallback>G</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <p className="max-w-[200px] truncate font-medium md:max-w-xs">
                            {movie?.title}
                          </p>
                          {movie?.release_date && (
                            <p className="text-xs text-muted-foreground">
                              {movie.release_date.split('-')[0]}
                              {movie.vote_average
                                ? ` • ${movie.vote_average.toFixed(1)}★`
                                : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className="bg-primary-foreground/70 text-xs"
                        >
                          {movie?.media_type}
                        </Badge>
                      </div>
                    </div>
                  </CommandItem>
                )
            )}
            {!deduplicatedData?.length && (
              <CommandItem className="h-8 justify-center">
                <div className="flex items-center gap-2">
                  <Icons.search className="size-4" />
                  <p className="text-sm">
                    Please type a movie or series name...
                  </p>
                </div>
              </CommandItem>
            )}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Shortcuts">
            <CommandItem
              className="cursor-pointer"
              onSelect={() => runCommand(() => router.push(`/`))}
            >
              <Home className="mr-2 size-4" />
              Home
            </CommandItem>
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
              onSelect={() => runCommand(() => router.push(`/watchlist`))}
            >
              <Bookmark className="mr-2 size-4" />
              My Watchlist
            </CommandItem>
            <CommandItem
              className="cursor-pointer"
              onSelect={() => runCommand(() => router.push(`/watch-history`))}
            >
              <Clock className="mr-2 size-4" />
              Watch History
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </CommandDialog>
    </>
  )
}
