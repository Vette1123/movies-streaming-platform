import React from 'react'
import Link from 'next/link'
import { ChevronRight, Tag } from 'lucide-react'

import { MovieGenre } from '@/types/movie-genre'
import { findMovieGenreById, findTvGenreById } from '@/lib/genres'
import { cn } from '@/lib/utils'

interface GenreChipsProps {
  genres?: MovieGenre[]
  mediaType: 'movie' | 'tv'
  className?: string
}

// Turns a title's genres into links to the genre landing pages. Each chip
// carries a tag icon and a chevron that slides in on hover, so it reads as
// "tap to explore" rather than a passive label. Only genres we actually route
// for become links; any stray one stays plain text (no dead link).
export function GenreChips({ genres, mediaType, className }: GenreChipsProps) {
  if (!genres?.length) return null

  const resolve = mediaType === 'movie' ? findMovieGenreById : findTvGenreById
  const basePath = mediaType === 'movie' ? '/movies/genre' : '/tv-shows/genre'
  const noun = mediaType === 'movie' ? 'movies' : 'series'

  return (
    <nav aria-label="Genres" className={cn('flex flex-col gap-2', className)}>
      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Genres
      </span>
      <ul className="flex flex-wrap gap-2">
        {genres.map((genre) => {
          const match = resolve(genre.id)

          if (!match) {
            return (
              <li
                key={genre.id}
                className="border-border/60 bg-background/40 text-foreground/70 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm lg:text-sm"
              >
                {genre.name}
              </li>
            )
          }

          return (
            <li key={genre.id}>
              <Link
                href={`${basePath}/${match.slug}`}
                aria-label={`Browse ${genre.name} ${noun}`}
                className="group border-border/70 bg-background/40 text-foreground/75 hover:border-primary/50 hover:bg-primary/10 hover:text-foreground focus-visible:ring-primary/50 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:outline-none lg:text-sm"
              >
                <Tag className="text-primary size-3 opacity-70 transition-opacity group-hover:opacity-100" />
                {genre.name}
                <ChevronRight className="text-primary -ml-1.5 h-3.5 w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:w-3.5 group-hover:opacity-100" />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
