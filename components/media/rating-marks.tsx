import React from 'react'

import type { RatingTile } from '@/lib/ratings'

/**
 * Each rating source's own mark, the one a reader already knows from the
 * source itself — drawn inline, so no request, no asset file, and it renders
 * in the server HTML.
 *
 * Wide marks keep their own aspect: size them by HEIGHT (`h-5 w-auto`), never
 * a square box. No gradients on purpose: an SVG gradient needs an id, and with
 * several copies on a page the first one decides — if that copy is inside a
 * hidden slide, every other copy loses its fill. Flat brand colours instead.
 * Hookless, so they render in server components (the ratings strip is one).
 */
type MarkProps = React.SVGProps<SVGSVGElement>

const TEXT_FONT =
  "'Arial Black', 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif"

/** IMDb: black wordmark on its yellow badge. */
export const ImdbMark = (props: MarkProps) => (
  <svg viewBox="0 0 64 32" role="img" aria-label="IMDb" {...props}>
    <rect width="64" height="32" rx="5" fill="#F5C518" />
    <text
      x="32"
      y="23.5"
      textAnchor="middle"
      fill="#000"
      fontFamily={TEXT_FONT}
      fontWeight="900"
      fontSize="19"
      textLength="50"
      lengthAdjust="spacingAndGlyphs"
    >
      IMDb
    </text>
  </svg>
)

/** TMDB: the short logo — wordmark and pill in the brand's two colours. */
export const TmdbMark = (props: MarkProps) => (
  <svg viewBox="0 0 84 32" role="img" aria-label="TMDB" {...props}>
    <text
      x="1"
      y="23.5"
      fill="#90CEA1"
      fontFamily={TEXT_FONT}
      fontWeight="900"
      fontSize="19"
      textLength="50"
      lengthAdjust="spacingAndGlyphs"
    >
      TMDB
    </text>
    <rect x="56" y="9.5" width="27" height="13" rx="6.5" fill="#01B4E4" />
  </svg>
)

/** Rotten Tomatoes, fresh: the red tomato with its green calyx. */
export const RtFreshMark = (props: MarkProps) => (
  <svg viewBox="0 0 32 32" role="img" aria-label="Rotten Tomatoes" {...props}>
    <circle cx="16" cy="18.5" r="12.5" fill="#FA320A" />
    <path
      fill="#00912D"
      d="M16 9.2c-1.3-2.6-3.6-3.5-6.1-3 1.6.9 2.4 2 2.6 3.2-1.7-.6-3.6-.2-5 1 2.2.1 3.7.8 4.6 2 1.4-.9 2.7-1.4 3.9-1.4s2.5.5 3.9 1.4c.9-1.2 2.4-1.9 4.6-2-1.4-1.2-3.3-1.6-5-1 .2-1.2 1-2.3 2.6-3.2-2.5-.5-4.8.4-6.1 3z"
    />
    <ellipse cx="11" cy="15.5" rx="3" ry="1.8" fill="#fff" opacity=".35" />
  </svg>
)

/** Rotten Tomatoes, rotten: the green splat. */
export const RtRottenMark = (props: MarkProps) => (
  <svg viewBox="0 0 32 32" role="img" aria-label="Rotten Tomatoes" {...props}>
    <path
      fill="#0AC855"
      d="M15.6 3.5c1.2 0 1.5 2.9 2.6 3.5 1.2.6 3.4-1.6 4.4-.7 1 .9-.9 3.3-.4 4.5.5 1.1 3.6 1 3.9 2.3.3 1.3-2.6 2.2-2.6 3.5 0 1.3 3 2.4 2.6 3.7-.4 1.2-3.4.6-4.2 1.6-.8 1 .7 3.7-.4 4.5-1.1.8-3.1-1.6-4.4-1.3-1.3.3-1.9 3.4-3.2 3.4s-1.6-3-2.8-3.5c-1.2-.5-3.5 1.6-4.4.7-.9-.9 1-3.2.5-4.3-.5-1.1-3.6-1-3.9-2.3-.3-1.3 2.7-2.1 2.8-3.4.1-1.3-2.8-2.6-2.4-3.8.4-1.2 3.4-.5 4.2-1.5.8-1-.6-3.8.5-4.5 1.1-.7 3 1.7 4.3 1.4 1.3-.3 1.7-3.8 2.9-3.8z"
    />
  </svg>
)

/** Metacritic: the white "m" in the black disc with its yellow ring. */
export const MetacriticMark = (props: MarkProps) => (
  <svg viewBox="0 0 32 32" role="img" aria-label="Metacritic" {...props}>
    <circle
      cx="16"
      cy="16"
      r="14.5"
      fill="#000"
      stroke="#FFCC34"
      strokeWidth="2.4"
    />
    <path
      fill="#fff"
      d="M8.2 22.2V11.3h2.9v1.4c.8-1.1 1.9-1.7 3.2-1.7 1.4 0 2.4.6 3 1.8.9-1.2 2-1.8 3.4-1.8 2.4 0 3.6 1.4 3.6 4.2v7h-3v-6.5c0-1.4-.5-2-1.6-2-1.2 0-1.8.8-1.8 2.3v6.2H15v-6.5c0-1.4-.5-2-1.6-2-1.2 0-1.8.8-1.8 2.3v6.2H8.2z"
    />
  </svg>
)

/** The mark for a tile; Rotten Tomatoes shows the splat when it is rotten. */
export function ratingMark(tile: Pick<RatingTile, 'id' | 'tone'>) {
  if (tile.id === 'imdb') return ImdbMark
  if (tile.id === 'metacritic') return MetacriticMark
  if (tile.id === 'rottenTomatoes')
    return tile.tone === 'rotten' ? RtRottenMark : RtFreshMark
  return TmdbMark
}
