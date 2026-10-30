/**
 * The picture a shared list or profile shows when somebody pastes the link.
 *
 * A poster mosaic, 1200x630: a blurred wallpaper, a row of posters and two lines
 * of text. The Worker answers `/api/og/card` with an SVG and wsrv rasterises it,
 * so the page only ever builds a URL, and wsrv's cache holds the result. A canvas
 * does not exist in workerd and a WASM rasteriser would not fit the 10ms CPU
 * budget; an SVG is only a string.
 *
 * The posters are embedded as data URIs because wsrv's renderer will not fetch a
 * remote `<image href>` (measured: it draws nothing). wsrv draws text, Arabic
 * included. The card's URL carries everything in it, so a renamed list gets a
 * new URL and a new card.
 */

import { buildWsrvURL } from '@/lib/tmdbConfig'

/** The 1.91:1 both Twitter and Facebook crop least. */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/** Where the Worker serves the card. WAF-exempt: wsrv's fetcher is a machine. */
export const OG_CARD_PATH = '/api/og/card'

const POSTER_WIDTH = 190
const POSTER_HEIGHT = 285
const POSTER_GAP = 20
const POSTER_TOP = 250
const MAX_POSTERS = 5

/**
 * How much text fits on one line, in characters. SVG has no wrapping, so nothing
 * stops a long name running off the right edge except cutting it here.
 */
const TITLE_MAX = 32
const SUBTITLE_MAX = 58

/**
 * A TMDB image path, and nothing else. These arrive from a synced payload and
 * then from a public query string, so a path that does not look exactly like
 * TMDB's is dropped rather than escaped.
 */
const SAFE_PATH = /^\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

/** Text as it may appear inside the SVG, control characters removed. */
export function escapeXml(text: string): string {
  return text
    .replace(/\p{Cc}/gu, '')
    .replace(/[&<>"']/g, (char) => XML_ESCAPES[char])
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

interface MosaicCard {
  title: string
  subtitle: string
  posters: string[]
}

const safePosters = (posters: MosaicInput['posters']) =>
  posters
    .filter(
      (path): path is string => typeof path === 'string' && SAFE_PATH.test(path)
    )
    .slice(0, MAX_POSTERS)

/**
 * The mosaic URL, or null when there is nothing to draw.
 *
 * Null rather than a placeholder: the caller already has a sensible fallback
 * (a single poster, an avatar), and an unfurl showing an empty frame is worse
 * than one showing whichever picture we do have.
 */
export function mosaicUrl(
  { title, subtitle, posters }: MosaicInput,
  siteUrl: string
): string | null {
  const paths = safePosters(posters)
  if (paths.length === 0) return null

  const card = new URLSearchParams({
    t: fitLine(title, TITLE_MAX),
    s: fitLine(subtitle, SUBTITLE_MAX),
    p: paths.join(','),
  })
  const source = encodeURIComponent(`${siteUrl}${OG_CARD_PATH}?${card}`)
  return `https://wsrv.nl/?url=${source}&w=${OG_WIDTH}&h=${OG_HEIGHT}&q=80&output=jpg`
}

/** The card a query string asks for, or null if it does not name one. */
export function parseMosaicCard(params: URLSearchParams): MosaicCard | null {
  const posters = safePosters((params.get('p') ?? '').split(','))
  if (posters.length === 0) return null
  return {
    title: fitLine(params.get('t') ?? '', TITLE_MAX),
    subtitle: fitLine(params.get('s') ?? '', SUBTITLE_MAX),
    posters,
  }
}

/** The poster as drawn in the row. */
export const mosaicPosterUrl = (path: string) =>
  buildWsrvURL(`/w500${path}`, POSTER_WIDTH, 75, 'jpg')

/** The wallpaper: wsrv blurs it, so the SVG only has to stretch a small file. */
export const mosaicWallpaperUrl = (path: string) =>
  `${buildWsrvURL(`/w500${path}`, 500, 50, 'jpg')}&blur=20`

/**
 * The card itself. `posterHrefs` lines up with `card.posters`; a poster that
 * failed to load is null and leaves the row one shorter.
 */
export function mosaicSvg(
  card: MosaicCard,
  wallpaperHref: string | null,
  posterHrefs: Array<string | null>
): string {
  const hrefs = posterHrefs.filter((href): href is string => Boolean(href))
  const row = hrefs.length * POSTER_WIDTH + (hrefs.length - 1) * POSTER_GAP
  const left = Math.round((OG_WIDTH - row) / 2)

  const clips: string[] = []
  const images = hrefs.map((href, index) => {
    const x = left + index * (POSTER_WIDTH + POSTER_GAP)
    const box = `x="${x}" y="${POSTER_TOP}" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}"`
    clips.push(`<clipPath id="c${index}"><rect ${box} rx="12"/></clipPath>`)
    return `<image ${box} clip-path="url(#c${index})" preserveAspectRatio="xMidYMid slice" xlink:href="${href}"/>`
  })
  const wallpaper = wallpaperHref
    ? `<image width="${OG_WIDTH}" height="${OG_HEIGHT}" preserveAspectRatio="xMidYMid slice" xlink:href="${wallpaperHref}"/>`
    : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${OG_WIDTH}" height="${OG_HEIGHT}">`,
    `<defs>${clips.join('')}</defs>`,
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#0B1120"/>`,
    wallpaper,
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#0B1120" fill-opacity="0.6"/>`,
    `<text x="85" y="130" font-family="sans-serif" font-size="58" font-weight="700" fill="#FFFFFF">${escapeXml(card.title)}</text>`,
    `<text x="85" y="190" font-family="sans-serif" font-size="30" fill="#CBD5E1">${escapeXml(card.subtitle)}</text>`,
    ...images,
    '</svg>',
  ].join('')
}
