import React from 'react'

import { MovieGenre } from '@/types/movie-genre'
import { findMovieGenreById, findTvGenreById } from '@/lib/genres'
import { mediaGenreBasePath } from '@/lib/media'
import { cn } from '@/lib/utils'
import { chipVariants } from '@/components/ui/chip'
import { GenreLink } from '@/components/media/genre-link'

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
  const basePath = mediaGenreBasePath(mediaType)
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
                className={cn(chipVariants({ variant: 'neutral' }), 'lg:text-sm')}
              >
                {genre.name}
              </li>
            )
          }

          return (
            <li key={genre.id}>
              <GenreLink
                href={`${basePath}/${match.slug}`}
                name={genre.name}
                ariaLabel={`Browse ${genre.name} ${noun}`}
                className="lg:text-sm"
              />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
