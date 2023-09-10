import { MovieDetails } from '@/types/movie-details'
import { convertMinutesToHours, moneyFormatter } from '@/lib/utils'

export const extraInfoFormatter = (
  movie: MovieDetails,
  director: string | undefined
) => [
  {
    name: 'Runtime:',
    value: convertMinutesToHours(movie?.runtime),
  },
  {
    name: 'Status:',
    value: movie?.status,
  },
  {
    name: 'Original Language:',
    value: movie?.original_language,
    className: 'uppercase',
  },
  {
    name: 'Budget:',
    value: moneyFormatter(movie?.budget),
  },
  {
    name: 'Revenue:',
    value: moneyFormatter(movie?.revenue),
  },
  {
    name: 'Director:',
    value: director,
    isLink: true,
  },
]
