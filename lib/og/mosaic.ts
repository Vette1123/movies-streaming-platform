/**
 * The picture a shared list or profile shows when somebody pastes the link.
 *
 * A poster mosaic, 1200x630, composed entirely in the image URL: ImageKit's
 * layer syntax draws the blurred wallpaper, the row of posters and the two
 * lines of text, and the Worker only ever builds a string. That matters more
 * than it sounds. The alternatives were a canvas (workerd has none), a WASM
 * rasteriser (a rendering library and a font, per request, against a 10ms CPU
 * budget) or an image endpoint of our own (a Worker invocation per unfurl, plus
 * one fetch per poster). This costs nothing at all, and every colo's ImageKit
 * cache holds the result.
 *
 * What it produces is the real thing rather than a nod at it: five posters, the
 * list's own name, and who it belongs to — see lessons/ for the two syntax
 * details that took the longest to find (chained `:` transforms, and `tw-`
 * being rejected outright).
 */

import { IMAGE_CACHE_HOST_URL } from '@/lib/constants'

/** The 1.91:1 both Twitter and Facebook crop least. */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const POSTER_WIDTH = 190
const POSTER_GAP = 20
const POSTER_TOP = 250
const MAX_POSTERS = 5

/**
 * How much text fits on one line, in characters.
 *
 * A guess, and it has to be: `tw-` (the layer's own wrap width) is rejected by
 * this account, so nothing stops a long name running off the right edge except
 * cutting it here. Measured against the widest common letters at each size,
 * with room to spare — a title that ends in an ellipsis is fine, one that ends
 * halfway off the card is not.
 */
const TITLE_MAX = 32
const SUBTITLE_MAX = 58

/**
 * A TMDB image path, and nothing else.
 *
 * These arrive from a synced payload, which is to say from whatever somebody
 * PUT into their own account — and they are about to be interpolated into a URL
 * whose commas and colons are an instruction language. A path that does not
 * look exactly like TMDB's is dropped rather than escaped: there is no legitimate
 * poster path with a colon in it.
 */
const SAFE_PATH = /^\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i

/** Text as ImageKit's `ie-` expects it: base64url, no padding. */
export function encodeOverlayText(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** One line of the card, tidied and cut to something that fits. */
export function fitLine(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

export interface MosaicInput {
  title: string
  subtitle: string
  /** Poster paths in list order. Nulls and junk are skipped, not rendered. */
  posters: Array<string | null | undefined>
}

/**
 * The mosaic URL, or null when there is nothing to draw.
 *
 * Null rather than a placeholder: the caller already has a sensible fallback
 * (a single poster, an avatar), and an unfurl showing an empty frame is worse
 * than one showing whichever picture we do have.
 */
export function mosaicUrl({
  title,
  subtitle,
  posters,
}: MosaicInput): string | null {
  if (!IMAGE_CACHE_HOST_URL) return null

  const paths = posters
    .filter(
      (path): path is string => typeof path === 'string' && SAFE_PATH.test(path)
    )
    .slice(0, MAX_POSTERS)
  if (paths.length === 0) return null

  // The wallpaper is the first poster, padded out to the frame and blurred into
  // a colour wash — so the card is tinted by the list it belongs to instead of
  // being the same navy rectangle every time.
  const parts = [
    `tr:w-${OG_WIDTH},h-${OG_HEIGHT},cm-pad_resize,bg-0B1120,bl-70,q-70`,
  ]

  const row = paths.length * POSTER_WIDTH + (paths.length - 1) * POSTER_GAP
  const left = Math.round((OG_WIDTH - row) / 2)
  paths.forEach((path, index) => {
    const x = left + index * (POSTER_WIDTH + POSTER_GAP)
    parts.push(
      `l-image,i-w500@@${path.slice(1)},w-${POSTER_WIDTH},lx-${x},ly-${POSTER_TOP},l-end`
    )
  })

  parts.push(
    `l-text,ie-${encodeOverlayText(fitLine(title, TITLE_MAX))},fs-58,co-FFFFFF,lx-85,ly-100,l-end`
  )
  parts.push(
    `l-text,ie-${encodeOverlayText(fitLine(subtitle, SUBTITLE_MAX))},fs-30,co-94A3B8,lx-85,ly-180,l-end`
  )

  return `${IMAGE_CACHE_HOST_URL}/${parts.join(':')}/w500${paths[0]}`
}
