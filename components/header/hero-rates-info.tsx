import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { MovieGenre } from '@/types/movie-genre'
import { ItemType, Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { genreToSlug } from '@/lib/genres'
import { mediaGenreBasePath, resolveMediaType } from '@/lib/media'
import { dateFormatter, getGenres } from '@/lib/utils'
import { Chip } from '@/components/ui/chip'
import { GenreLink } from '@/components/media/genre-link'
import { ScoreChip } from '@/components/media/score-chip'

interface HeroRatesInfosProps {
  movie?: Movie
  movieDetails?: MovieDetails
  seriesDetails?: SeriesDetails
  genreTable?: MovieGenre[]
}

// Detail pages know their type up front (movieDetails/seriesDetails); the mixed
// homepage hero only has a `movie` whose type is inferred. Flat guard chain so
// the precedence stays readable (no nested ternary).
function resolveHeroMediaType(
  movieDetails?: MovieDetails,
  seriesDetails?: SeriesDetails,
  movie?: Movie
): ItemType {
  if (movieDetails) return 'movie'
  if (seriesDetails) return 'tv'
  return movie ? resolveMediaType(movie) : 'movie'
}

// Memoised: every prop is a payload object the server rendered once, so they are
// referentially stable and this row — chips, score, formatted date, up to three
// genre links, plus the getGenres lookup — need not be rebuilt each time the
// carousel re-renders the slide around it.
export const HeroRatesInfos = React.memo(function HeroRatesInfos({
  movie,
  movieDetails,
  seriesDetails,
  genreTable,
}: HeroRatesInfosProps) {
  const item = (movieDetails || movie || seriesDetails) as (
    MovieDetails | Movie
  ) &
    SeriesDetails
  // Resolve media type: detail pages pass movieDetails/seriesDetails directly;
  // the homepage hero (mixed trending/all) passes a `movie` whose type comes
  // from media_type (or the TV-only first_air_date). Drives both the genre
  // table and where each genre badge links.
  const mediaType = resolveHeroMediaType(movieDetails, seriesDetails, movie)
  const genreBasePath = mediaGenreBasePath(mediaType)
  const movieGenres = getGenres(
    movie?.genre_ids,
    movieDetails?.genres || seriesDetails?.genres,
    mediaType,
    genreTable
  )

  // Prefer the real IMDb score (detail pages only) and label it as such; the
  // TMDB average is the fallback and keeps its star treatment.
  const imdbRating = movieDetails?.imdbRating ?? seriesDetails?.imdbRating

  // my-2 on mobile: this row wraps to two lines on a phone (language, rating,
  // score, date + up to three genres), so its own margins are the cheapest
  // vertical space to give back to the hero copy. Full spacing from sm up.
  return (
    <div className="my-2 flex flex-wrap items-center gap-2 sm:my-3 lg:my-4 lg:gap-3">
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
        <GenreLink
          key={genre.id}
          href={`${genreBasePath}/${genreToSlug(genre.name)}`}
          name={genre.name}
        />
      ))}
    </div>
  )
})
