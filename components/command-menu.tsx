'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { searchMovieAction } from '@/actions/search'
import { Home, Tv } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'

import { MediaType } from '@/types/media'
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

const handleUniqueTitle = (
  titleCount: number,
  releaseYearMonth: string,
  movie: MediaType
) => {
  if (titleCount > 0 && releaseYearMonth) {
    return `${movie.title} - (${releaseYearMonth})`
  }
  if (titleCount > 0) {
    return `${movie.title} - (${titleCount})`
  }
  return movie.title
}

export function CommandMenu({ ...props }: CommandDialogProps) {
  const { open, setOpen, runCommand, isLoading, setIsLoading } =
    useCMDKListener()
  const [data, setData] = React.useState<MediaType[]>([])
  const router = useRouter()

  const getMovieResults = async (value: string) => {
    if (!value) return
    setIsLoading(true)
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

  const deduplicatedData: MediaType[] = (data || []).reduce(
    (acc, movie) => {
      const lowercaseTitle = movie?.title?.toLowerCase()
      if (lowercaseTitle) {
        const releaseDate = movie?.release_date?.split('-')
        const releaseYearMonth =
          releaseDate && releaseDate?.filter(Boolean).length
            ? `${releaseDate[0]}-${releaseDate[1]}`
            : ''
        const titleCount = acc.titleCounts[lowercaseTitle] || 0
        const uniqueTitle = handleUniqueTitle(
          titleCount,
          releaseYearMonth,
          movie
        )
        acc.titleCounts[lowercaseTitle] = titleCount + 1
        acc.result.push({ ...movie, title: uniqueTitle })
      }
      return acc
    },
    { titleCounts: {} as Record<string, number>, result: [] as MediaType[] }
  )?.result

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
                        <p className="max-w-[200px] truncate md:max-w-xs">
                          {movie?.title}
                        </p>
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
                  window.open(`https://www.mohamedgado.site/`, '_blank')
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
