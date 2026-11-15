import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { convertMinutesToHours, moneyFormatter } from '@/lib/utils'

export const movieExtraInfoFormatter = (
  movie: MovieDetails,
  director: string | undefined
) => [
  {
    name: 'Runtime',
    value: convertMinutesToHours(movie?.runtime),
  },
  {
    name: 'Status',
    value: movie?.status,
  },
  {
    name: 'Original Language',
    value: movie?.original_language,
    className: 'uppercase',
  },
  {
    name: 'Budget',
    value: moneyFormatter(movie?.budget),
  },
  {
    name: 'Revenue',
    value: moneyFormatter(movie?.revenue),
  },
  ...(director ? [{ name: 'Director', value: director, isLink: true }] : []),
]

/**
 * The rows worth a line: TMDB leaves `last_air_date` null on a running show,
 * `origin_country` empty on many titles and `overview` blank on new ones, and
 * a label over nothing reads as a broken page.
 */
export const filledInfoRows = <T extends { value: unknown }>(rows: T[]) =>
  rows.filter(
    (row) =>
      row.value !== null &&
      row.value !== undefined &&
      String(row.value).trim() !== ''
  )

export const seriesExtraInfoFormatter = (
  series: SeriesDetails,
  director: string | undefined
) => [
  {
    name: 'First Air Date',
    value: series?.first_air_date,
  },
  {
    name: 'Last Air Date',
    value: series?.last_air_date,
  },
  {
    name: 'Status',
    value: series?.status,
  },
  {
    name: 'Original Country',
    value: series?.origin_country?.join(', '),
  },
  {
    name: 'Original Language',
    value: series?.original_language,
    className: 'uppercase',
  },
  {
    name: 'Number of Seasons',
    value: series?.number_of_seasons,
  },
  {
    name: 'Number of Episodes',
    value: series?.number_of_episodes,
  },
  ...(director
    ? [
        {
          name: 'Director',
          value: director,
          isLink: true,
        },
      ]
    : []),
  ...(series?.created_by?.length
    ? [
        {
          name: 'Created By',
          value: series?.created_by?.map((creator) => creator.name).at(0),
          isLink: true,
        },
      ]
    : []),
]
