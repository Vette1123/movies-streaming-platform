import { Star } from 'lucide-react'

import { cn, numberRounder } from '@/lib/utils'
import { Chip } from '@/components/ui/chip'

interface ScoreChipProps {
  /** Real IMDb score (preferred). Renders the IMDb wordmark chip. */
  imdbRating?: string | number | null
  /** TMDB vote average, used when no IMDb score is present. */
  voteAverage?: number | null
  size?: 'sm' | 'md'
  className?: string
}

/**
 * The one true rating chip. Prefers the IMDb wordmark; falls back to the
 * amber-star TMDB average. Replaces the three hand-rolled IMDb pills (card,
 * hero, command menu) that each used a different radius/size/padding.
 */
export function ScoreChip({
  imdbRating,
  voteAverage,
  size = 'sm',
  className,
}: ScoreChipProps) {
  if (imdbRating) {
    return (
      <Chip variant="imdb" size={size} className={className}>
        IMDb
        <span className="font-bold tabular-nums">{imdbRating}</span>
      </Chip>
    )
  }

  return (
    <Chip
      variant="rating"
      size={size}
      className={cn('tabular-nums', className)}
    >
      <Star className="size-3 fill-current" aria-hidden />
      {numberRounder(voteAverage ?? undefined) ?? 'NR'}
    </Chip>
  )
}
