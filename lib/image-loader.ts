// Custom next/image loader — the reason the site has responsive images at all.
//
// `output: 'export'` cannot use Next's built-in optimizer, and `images.unoptimized`
// would stop next/image emitting a `srcset` entirely, so every device would
// download whatever width the URL happened to name. A custom loader is the
// supported escape hatch: next/image still generates the srcset and honours
// `sizes`, and this function decides what each width's URL looks like. wsrv
// resizes from the URL, so the width is simply substituted into it.
//
// Anything else (Unsplash, avatars, the TMDB origin last resort) passes through
// untouched — the origin has no resizing to ask for.

import { buildWsrvURL, extractTMDBPath, isWsrvURL } from './tmdbConfig'

interface LoaderArgs {
  src: string
  width: number
  quality?: number
}

/**
 * How many pixels wide the underlying TMDB file actually is — or, for
 * `/original`, how wide we are willing to ask for.
 *
 * A `w500` path caps at 500: asking for more upscales it, which is more bytes
 * for strictly no more detail. `original` has no fixed width, so this is a
 * spending decision rather than a fact, and it is the ceiling on how sharp a
 * full-bleed hero can be. A 1512px retina laptop — the common desktop — paints
 * its 100svh hero at 3377 device px, which 3072 covers at 0.91; 3840 would buy
 * the last 9% for 60% more bytes. See docs/image-cdn.md for the measurements.
 *
 * `widthFromPath` in lib/tmdbConfig.ts carries the same ceiling and has to move
 * with this one.
 */
const ORIGINAL_MAX_WIDTH = 3072

function sourceWidth(src: string): number {
  const size = src.match(/\/(original|w(\d+))\//)
  if (!size) return ORIGINAL_MAX_WIDTH
  return size[2] ? Number(size[2]) : ORIGINAL_MAX_WIDTH
}

export default function imageLoader({ src, width, quality }: LoaderArgs) {
  if (!isWsrvURL(src)) return src
  const path = extractTMDBPath(src)
  if (!path) return src
  // Never ask for more than the TMDB size segment holds. `&we` inside
  // buildWsrvURL covers the `/original` case, where the segment names no width
  // at all and the ceiling is only an upper bound.
  return buildWsrvURL(path, Math.min(width, sourceWidth(path)), quality)
}

// The rungs next/image offers above 256: its `deviceSizes`, plus the two
// `imageSizes` the app reaches.
const CANDIDATE_WIDTHS = [
  256, 320, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
]

/**
 * The srcset a wsrv image's <img> carries, for a preload. Built by the same
 * loader next/image calls, so the preload and the <img> name the same URLs and
 * the browser fetches the hero once.
 *
 * Widths above the source are dropped rather than clamped — clamping produces
 * several identical URLs under different `w` descriptors, which invites the
 * browser to pick a 2560w-labelled candidate that is really 500px wide.
 */
export function wsrvSrcSet(src: string, quality?: number) {
  if (!isWsrvURL(src)) return undefined
  const max = sourceWidth(src)
  return [...CANDIDATE_WIDTHS.filter((w) => w < max), max]
    .map((w) => `${imageLoader({ src, width: w, quality })} ${w}w`)
    .join(', ')
}

const PORTRAIT_WIDTHS = [360, 480, 648, 750]

/**
 * A backdrop cropped to 3:5 for a portrait phone: see lib/image-sizes.ts.
 * Undefined off wsrv, which is what lets the fallback chain take over: a
 * <source> outranks the <img> src it would be setting.
 */
export function wsrvPortraitSrcSet(src: string, quality?: number) {
  if (!isWsrvURL(src)) return undefined
  return PORTRAIT_WIDTHS.map((w) => {
    const url = imageLoader({ src, width: w, quality })
    return `${url}&h=${Math.round((w * 5) / 3)}&fit=cover ${w}w`
  }).join(', ')
}
