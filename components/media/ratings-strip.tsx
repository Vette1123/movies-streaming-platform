import React from 'react'

import { RatingTile } from '@/lib/ratings'
import { cn } from '@/lib/utils'
import { CountUpNumber } from '@/components/media/count-up-number'
import { ratingMark } from '@/components/media/rating-marks'

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
 * Each source's brand colour, as the tint a tile glows with from the top. The
 * source's own colour, never the theme's, so the four tiles are told apart
 * before a word is read — and Rotten Tomatoes follows its verdict, red tomato
 * or green splat, exactly like its mark.
 */
const BRAND_TINT: Record<RatingTile['tone'], string> = {
  imdb: '245 197 24',
  tmdb: '1 180 228',
  fresh: '250 50 10',
  rotten: '10 200 85',
  'metacritic-good': '255 204 52',
  'metacritic-mid': '255 204 52',
  'metacritic-bad': '255 204 52',
}

/** A static radial wash of the brand colour, centred on the mark. */
const tintStyle = (tone: RatingTile['tone']): React.CSSProperties => ({
  backgroundImage: `radial-gradient(120% 85% at 50% 0%, rgb(${BRAND_TINT[tone]} / 0.22), transparent 62%)`,
})

/**
 * The ratings row on a details page: TMDB, IMDb, Rotten Tomatoes and
 * Metacritic, side by side.
 *
 * One centred axis per tile: the source's real mark (rating-marks.tsx) at
 * 40px, the score under it as the largest thing on the tile, and its caption
 * (votes, the Fresh/Rotten verdict, "Metascore") last. The number is the
 * answer; the mark is the attribution; the tint is the brand, so the eye finds
 * IMDb by colour before it reads a letter. All static: the tint is a
 * background, not a layer, and nothing moves but the score's one-off count-up.
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
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => {
          const Mark = ratingMark(tile)
          return (
            <li
              key={tile.id}
              style={tintStyle(tile.tone)}
              className="flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-secondary/40 px-3 pt-6 pb-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
            >
              {/* The source's name for a screen reader; the mark says it on
                  screen. */}
              <span className="sr-only">{tile.label}</span>
              <Mark
                aria-hidden
                className="h-[40px] w-auto max-w-full shrink-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)]"
              />
              <span
                className={cn(
                  'text-[40px] leading-none font-extrabold tracking-tight tabular-nums sm:text-[44px]',
                  TONE_CLASS[tile.tone]
                )}
              >
                <CountUpNumber score={tile.score} />
              </span>
              {tile.detail ? (
                <span className="max-w-full truncate text-xs font-medium tracking-wider text-white/60 uppercase">
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
  // One source is enough. A new release usually has only TMDB's score, and
  // requiring two hid the row on almost every hero slide.
  if (!tiles.length) return null
  return (
    <ul
      className={cn(
        'flex flex-wrap items-center gap-2 text-[15px] leading-none font-semibold',
        className
      )}
    >
      {tiles.map((tile) => {
        const Mark = ratingMark(tile)
        return (
          <li
            key={tile.id}
            className={cn(
              // Solid tint, no backdrop-blur: on the home hero these sit over
              // a playing trailer preview, and a backdrop-filter re-blurs
              // what is behind each pill on every video frame.
              'flex items-center gap-2 rounded-full bg-black/60 py-1.5 pr-3 pl-2 ring-1 ring-white/10',
              TONE_CLASS[tile.tone]
            )}
          >
            {/* The mark IS the label here: a TMDB badge already says TMDB. */}
            <Mark aria-hidden className="h-[20px] w-auto shrink-0" />
            <span className="sr-only">{tile.label}</span>
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
