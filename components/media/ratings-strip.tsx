import React from 'react'

import { RatingTile } from '@/lib/ratings'
import { cn } from '@/lib/utils'

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

/**
 * The ratings row on a details page: IMDb, Rotten Tomatoes, Metacritic and
 * TMDB, side by side, with the vote count under the scores that have one.
 *
 * The score is the largest thing in its tile and the source name is the
 * smallest — the number is the answer, the name is the attribution.
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
        {tiles.map((tile) => (
          <li
            key={tile.id}
            className="flex flex-col rounded-lg border border-white/10 bg-secondary/40 px-3 py-2.5 ring-1 ring-white/5 ring-inset"
          >
            <span className="text-[10px] font-semibold tracking-[0.08em] text-white/60 uppercase">
              {tile.label}
            </span>
            <span
              className={cn(
                'mt-1 text-2xl leading-none font-bold tabular-nums',
                TONE_CLASS[tile.tone]
              )}
            >
              {tile.score}
            </span>
            {tile.detail ? (
              <span className="mt-1.5 text-[11px] text-white/55">
                {tile.detail}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
