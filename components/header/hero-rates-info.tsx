import React from 'react'

import { Movie } from '@/types/movie-result'
import { dateFormatter, getGenres } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'

export const HeroRatesInfos = ({ movie }: { movie: Movie }) => {
  const movieGenres = getGenres(movie.genre_ids)
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 lg:gap-3">
      <Badge className="uppercase">{movie.original_language}</Badge>
      <Badge className="uppercase">{movie.adult ? 'NC-17' : 'G'}</Badge>
      <div className="flex items-center text-xs lg:text-base">
        <Icons.fullStar className="mr-1 inline-block" />
        <p>{movie.vote_average}</p>
      </div>
      <p className="text-xs text-popover-foreground lg:text-base">
        {dateFormatter(movie.release_date)}
      </p>
      {movieGenres.map((genre) => (
        <Badge key={genre.id} className="font-medium">
          {genre.name}
        </Badge>
      ))}
    </div>
  )
}
