import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { dateFormatter, getGenres, numberRounder } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'

interface HeroRatesInfosProps {
  movie?: Movie
  movieDetails?: MovieDetails
  seriesDetails?: SeriesDetails
}

export const HeroRatesInfos = ({
  movie,
  movieDetails,
  seriesDetails,
}: HeroRatesInfosProps) => {
  const item = (movieDetails || movie || seriesDetails) as (
    | MovieDetails
    | Movie
  ) &
    SeriesDetails
  const movieGenres = getGenres(
    movie?.genre_ids,
    movieDetails?.genres || seriesDetails?.genres
  )

  const displayRating = () => {
    // Show IMDB rating if available for movieDetails or seriesDetails
    if (movieDetails?.imdbRating) {
      return <span className="font-semibold">{movieDetails.imdbRating}</span>
    }

    if (seriesDetails?.imdbRating) {
      return <span className="font-semibold">{seriesDetails.imdbRating}</span>
    }

    // Fallback to TMDB rating
    return (
      <span className="font-semibold">{numberRounder(item?.vote_average)}</span>
    )
  }

  return (
    <div className="my-4 flex flex-wrap items-center gap-2 lg:gap-3">
      <Badge className="uppercase">{item?.original_language}</Badge>
      <Badge className="uppercase">{item?.adult ? 'NC-17' : 'PG-13'}</Badge>
      <div className="flex items-center text-xs lg:text-base">
        <Icons.fullStar className="mr-1 h-6 w-6" />
        {displayRating()}
      </div>
      <p className="text-xs text-popover-foreground lg:text-base">
        {dateFormatter(item?.release_date || item?.first_air_date)}
      </p>
      {movieGenres.map((genre) => (
        <Badge key={genre.id} className="font-medium">
          {genre.name}
        </Badge>
      ))}
    </div>
  )
}
