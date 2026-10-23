import React from 'react'

import { RatingTile } from '@/lib/ratings'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'
import { CountUpNumber } from '@/components/media/count-up-number'

/**
 * The score wears the SOURCE's accent, not the theme's: IMDb's own yellow,
 * the amber TMDB already uses for its star, and Rotten Tomatoes' and
 * Metacritic's own good/mid/bad bands.
 *
 * That makes the colour say something the number already says, which is the
 * only reason a colour is here at all — a title's verdict, at a glance, in the
 * colours the verdict is usually shown in.
 */
const TONE_CLASS: Record<RatingTile['tone'], string> = {
  imdb: 'text-[#f5c518]',
  fresh: 'text-emerald-400',
  rotten: 'text-red-500',
  'metacritic-good': 'text-emerald-400',
  'metacritic-mid': 'text-amber-300',
  'metacritic-bad': 'text-red-500',
  tmdb: 'text-amber-300',
}

/** Each source's own mark — the logo a reader already knows from the source
 * itself. Coloured to match the tone, never themed away. */
const SOURCE_ICON: Record<
  RatingTile['id'],
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  imdb: Icons.ratingImdb,
  rottenTomatoes: Icons.ratingRottenTomatoes,
  metacritic: Icons.ratingMetacritic,
  tmdb: Icons.ratingTmdb,
}

/**
 * The ratings row on a details page: IMDb, Rotten Tomatoes, Metacritic and
 * TMDB, side by side, each with its own mark and score.
 *
 * The source mark sits above the label in a coloured disc so it's unmistakable
 * at a glance. The score is the largest thing in the tile — the number is the
 * answer, the mark is the attribution.
 *
 * Renders nothing when there is no rating to show. A row of empty boxes
 * ("NR" everywhere) is a claim about the film; a missing row is not.
 */
export function RatingsStrip({
  tiles,
  className,
}: {
  tiles: RatingTile[]
  className?: string
}) {
  if (!tiles.length) return null

  return (
    <section aria-label="Ratings" className={className}>
      <h2 className="mb-3 text-base font-semibold md:text-xl lg:text-2xl">
        Ratings
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = SOURCE_ICON[tile.id]
          const tone = TONE_CLASS[tile.tone]
          return (
            <li
              key={tile.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-secondary/40 p-3"
            >
              <div
                className={cn(
                  'flex size-10 items-center justify-center rounded-full bg-white/6 text-white shadow-[0_0_16px_rgba(255,255,255,0.15)]',
                  tone
                )}
              >
                <Icon height={20} width={20} />
              </div>
              <span className="text-[10px] font-semibold tracking-wider text-white/60 uppercase">
                {tile.label}
              </span>
              <span
                className={cn(
                  'mt-0.5 text-3xl leading-none font-bold tabular-nums',
                  tone
                )}
              >
                <CountUpNumber score={tile.score} />
              </span>
              {tile.detail ? (
                <span className="mt-0.5 text-[10px] tracking-wider text-white/55 uppercase">
                  {tile.detail}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * The same four scores, in one line.
 *
 * For a place that has no room for a grid of tiles - the hero's rating row -
 * and it is not a smaller version of the strip, it is the same information
 * with the same colours: the source's name, its score, and the source's own
 * accent. A reader who learns the tiles on the details page reads the pills
 * on the hero without a second thought, which is the point of them being the
 * same four sources in the same order.
 */
export function RatingsPills({
  tiles,
  className,
}: {
  tiles: RatingTile[]
  className?: string
}) {
  if (tiles.length < 2) return null
  return (
    <ul
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-none font-semibold',
        className
      )}
    >
      {tiles.map((tile) => {
        const Icon = SOURCE_ICON[tile.id]
        return (
          <li
            key={tile.id}
            className={cn(
              'flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1 ring-1 ring-white/10 backdrop-blur-sm',
              TONE_CLASS[tile.tone]
            )}
          >
            <Icon height={14} width={14} />
            <span className="text-[10px] font-medium tracking-wide text-white/60 uppercase">
              {tile.label}
            </span>
            <span
              className={cn('font-bold tabular-nums', TONE_CLASS[tile.tone])}
            >
              <CountUpNumber score={tile.score} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
