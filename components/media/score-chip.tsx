import { cn } from '@/lib/utils'
import { Chip } from '@/components/ui/chip'
import { SpriteIcon } from '@/components/icon-sprite'

interface ScoreChipProps {
  /**
   * The score, as the site's canonical source has it: TMDB's average.
   *
   * It used to prefer the IMDb score when a title had one, which made the
   * same film show two different numbers in two places — "IMDb 9.3" on the
   * details hero, "8" on the card and the homepage hero for the same title.
   * One score, one number, everywhere: the card, the hero, the details hero
   * and the ratings strip all say the same thing, and the other sources are
   * the labelled extras on the details page.
   */
  voteAverage?: number | null
  size?: 'sm' | 'md'
  className?: string
}

/**
 * The one true rating chip: the site's canonical score, in the site's
 * canonical format.
 *
 * One decimal, always — "8.0", never "8". The ratings strip writes the same
 * number the same way, and a card that says "8" next to a details page that
 * says "8.0" is the same inconsistency in a different font.
 */
export function ScoreChip({
  voteAverage,
  size = 'sm',
  className,
}: ScoreChipProps) {
  const score =
    typeof voteAverage === 'number' && Number.isFinite(voteAverage)
      ? voteAverage.toFixed(1)
      : null

  return (
    <Chip
      variant="rating"
      size={size}
      className={cn('tabular-nums', className)}
    >
      {/* Sprite, not lucide: this chip renders on every card, and the star's
          path is the single heaviest repeated shape on a list page. */}
      <SpriteIcon name="star" className="size-3" />
      {score ?? 'NR'}
    </Chip>
  )
}
