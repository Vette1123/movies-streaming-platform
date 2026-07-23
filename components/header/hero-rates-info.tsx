import React from 'react'
import Link from 'next/link'

import { MovieDetails } from '@/types/movie-details'
import { MovieGenre } from '@/types/movie-genre'
import { ItemType, Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { genreToSlug } from '@/lib/genres'
import { dateFormatter, getGenres } from '@/lib/utils'
import { Chip, chipVariants } from '@/components/ui/chip'
import { ScoreChip } from '@/components/media/score-chip'

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
    <div className="my-3 flex flex-wrap items-center gap-2 lg:my-4 lg:gap-3">
      <Chip variant="outline" uppercase>
        {item?.original_language}
      </Chip>
      <Chip variant={item?.adult ? 'danger' : 'outline'} uppercase>
        {item?.adult ? 'NC-17' : 'PG-13'}
      </Chip>
      <ScoreChip
        imdbRating={imdbRating}
        voteAverage={item?.vote_average}
        size="md"
      />
      <p className="text-xs text-white/90 drop-shadow-sm lg:text-sm">
        {dateFormatter(item?.release_date || item?.first_air_date)}
      </p>
      {movieGenres.map((genre) => (
        <Link
          key={genre.id}
          href={`${genreBasePath}/genre/${genreToSlug(genre.name)}`}
          className={chipVariants({ variant: 'neutral', interactive: true })}
        >
          {genre.name}
        </Link>
      ))}
    </div>
  )
}
