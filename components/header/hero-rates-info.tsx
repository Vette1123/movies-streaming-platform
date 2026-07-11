import React from 'react'
import Link from 'next/link'

import { MovieDetails } from '@/types/movie-details'
import { MovieGenre } from '@/types/movie-genre'
import { ItemType, Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { genreToSlug } from '@/lib/genres'
import { dateFormatter, getGenres, numberRounder } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'

interface HeroRatesInfosProps {
  movie?: Movie
  movieDetails?: MovieDetails
  seriesDetails?: SeriesDetails
  genreTable?: MovieGenre[]
}

export const HeroRatesInfos = ({
  movie,
  movieDetails,
  seriesDetails,
  genreTable,
}: HeroRatesInfosProps) => {
  const item = (movieDetails || movie || seriesDetails) as (
    | MovieDetails
    | Movie
  ) &
    SeriesDetails
  // Resolve media type: detail pages pass movieDetails/seriesDetails directly;
  // the homepage hero (mixed trending/all) passes a `movie` whose type comes
  // from media_type (or the TV-only first_air_date). Drives both the genre
  // table and where each genre badge links.
  const mediaType: ItemType = movieDetails
    ? 'movie'
    : seriesDetails
      ? 'tv'
      : (movie?.media_type ?? (movie?.first_air_date ? 'tv' : 'movie'))
  const genreBasePath = mediaType === 'tv' ? '/tv-shows' : '/movies'
  const movieGenres = getGenres(
    movie?.genre_ids,
    movieDetails?.genres || seriesDetails?.genres,
    mediaType,
    genreTable
  )

  // Prefer the real IMDb score (detail pages only) and label it as such; the
  // TMDB average is the fallback and keeps its star treatment.
  const imdbRating = movieDetails?.imdbRating ?? seriesDetails?.imdbRating

  return (
    <div className="my-4 flex flex-wrap items-center gap-2 lg:gap-3">
      <Badge className="uppercase">{item?.original_language}</Badge>
      <Badge className="uppercase">{item?.adult ? 'NC-17' : 'PG-13'}</Badge>
      {imdbRating ? (
        <div className="flex items-center gap-1.5 text-xs text-white drop-shadow-sm lg:text-base">
          <span className="rounded-[3px] bg-[#f5c518] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-black lg:text-xs">
            IMDb
          </span>
          <span className="font-semibold">{imdbRating}</span>
        </div>
      ) : (
        <div className="flex items-center text-xs text-white drop-shadow-sm lg:text-base">
          <Icons.fullStar className="mr-1 h-6 w-6" />
          <span className="font-semibold">
            {numberRounder(item?.vote_average)}
          </span>
        </div>
      )}
      <p className="text-xs text-white/90 drop-shadow-sm lg:text-base">
        {dateFormatter(item?.release_date || item?.first_air_date)}
      </p>
      {movieGenres.map((genre) => (
        <Link
          key={genre.id}
          href={`${genreBasePath}/genre/${genreToSlug(genre.name)}`}
        >
          <Badge className="hover:bg-primary/80 font-medium transition-colors">
            {genre.name}
          </Badge>
        </Link>
      ))}
    </div>
  )
}
