// Custom next/image loader — the reason the site has responsive images at all.
//
// `output: 'export'` cannot use Next's built-in optimizer, and the config used
// to say `images.unoptimized: true`. That does not just skip resizing: it stops
// next/image emitting a `srcset` entirely, so every device downloaded and
// decoded whatever width the URL happened to name. The hero backdrop names
// w-2560, so a 393px phone was decoding a 2560x1440 image — three of them, since
// the carousel keeps a neighbour mounted either side. Measured as ~400ms frames
// during a swipe on a throttled phone profile.
//
// A custom loader is the supported escape hatch: next/image still generates the
// srcset and honours `sizes`, and this function decides what each width's URL
// looks like. ImageKit already resizes from the URL, so the width simply gets
// substituted into the transform it is asked for.
//
// The chain's SECOND stage is rewritten too, in wsrv's own query syntax. It used
// to pass through untouched, which quietly cost the fallback everything this
// loader exists for: a URL the loader does not rewrite produces a srcset whose
// candidates are all the same file under different `w` descriptors, so the whole
// site pinned itself to the single width baked into the fallback URL — 2560 for
// anything off `/original`. A phone that fell off ImageKit downloaded a 2560px
// hero (118 KB measured) where the width it actually paints costs 18 KB, and it
// got that 2560px image by UPSCALING sources that are natively 1280 or 780 (see
// buildWsrvURL's `&we`). Byte-for-byte at a matched width wsrv and ImageKit are
// identical, so with this the fallback is not a downgrade in anything but AVIF.
//
// Anything else (Unsplash, avatars, the TMDB origin last resort) still passes
// through untouched — the origin has no resizing to ask for.

import { buildWsrvURL, extractTMDBPath, isWsrvURL } from './tmdbConfig'

interface LoaderArgs {
  src: string
  width: number
  quality?: number
}

/** e.g. "/tr:w-2560,q-82,f-auto,pr-true/original/abc.jpg" */
const TRANSFORM = /\/tr:([^/]+)\//

/**
 * How many pixels wide the underlying TMDB file actually is — or, for
 * `/original`, how wide we are willing to ask for.
 *
 * A `w500` path caps at 500: asking ImageKit for more upscales it, which is
 * more bytes for strictly no more detail. `original` has no fixed width, so
 * this is a spending decision rather than a fact, and it is the ceiling on how
 * sharp a full-bleed hero can be. Measured on a hero backdrop (AVIF, q65 — what
 * the heroes actually serve since they stopped preloading WebP):
 *
 *   w1920  45 KB    w2560  64 KB    w3072  82 KB    w3840 126 KB
 *
 * A 1512px retina laptop — the common desktop — paints its 100svh hero at 3377
 * device px. At 2560 that was 0.76 of what it paints; 3072 makes it 0.91 for
 * +18 KB, and 3840 would buy the last 9% for +62 KB. So: 3072.
 *
 * `widthFromPath` in lib/tmdbConfig.ts is the same ceiling for the wsrv stage
 * and has to move with this one.
 */
const ORIGINAL_MAX_WIDTH = 3072

function sourceWidth(src: string): number {
  const size = src.match(/\/(original|w(\d+))\//)
  if (!size) return ORIGINAL_MAX_WIDTH
  return size[2] ? Number(size[2]) : ORIGINAL_MAX_WIDTH
}

/** Is this a URL this loader can rewrite at all? */
export function isImageKitURL(src: string) {
  return TRANSFORM.test(src)
}

function buildURL({
  src,
  width,
  quality,
  format,
}: LoaderArgs & { format?: string }) {
  const match = src.match(TRANSFORM)
  if (!match) return src

  // Never ask for more than the source has. Without this the thumbnail URLs
  // (whose size comes from the TMDB path segment, e.g. /w500) would be asked for
  // 3840 and ImageKit would happily upscale a 500px poster.
  const target = Math.min(width, sourceWidth(src))

  const params = match[1].split(',')
  let sawWidth = false

  const rewritten = params.map((param) => {
    if (param.startsWith('w-')) {
      sawWidth = true
      return `w-${target}`
    }
    if (quality && param.startsWith('q-')) return `q-${quality}`
    if (format && param.startsWith('f-')) return `f-${format}`
    return param
  })

  // Thumbnail transforms carry no `w-` of their own, so add one. Posters in a
  // grid paint at ~200px CSS; serving them the full w500 source at every size
  // was the same waste as the hero, one order of magnitude smaller and forty
  // times per list page.
  if (!sawWidth) rewritten.unshift(`w-${target}`)

  return src.replace(TRANSFORM, `/tr:${rewritten.join(',')}/`)
}

export default function imageKitLoader({ src, width, quality }: LoaderArgs) {
  if (isWsrvURL(src)) {
    const path = extractTMDBPath(src)
    if (!path) return src
    // Same clamp as ImageKit: never ask for more than the TMDB size segment
    // holds. `&we` inside buildWsrvURL covers the `/original` case, where the
    // segment names no width at all and 2560 is only an upper bound.
    return buildWsrvURL(path, Math.min(width, sourceWidth(path)), quality)
  }
  return buildURL({ src, width, quality })
}

// The rungs the AVIF srcset offers. Next's own default ladder starts at 16px
// (its `imageSizes`, meant for avatars and icons), and every rung below 256 is
// dead weight here: the smallest image this app renders is a ~160px poster,
// which even at dpr 1 reaches for 256. Those six unused rungs were 40% of the
// srcset text, repeated for every image on the page — a real cost, since it is
// paid in the DOCUMENT, which is on the critical path in a way the images
// themselves are not. Above 256 this matches next/image's `deviceSizes`
// exactly, so the two srcsets can't disagree about which candidate fits a
// given `sizes`.
const CANDIDATE_WIDTHS = [256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]

/**
 * An AVIF srcset for the same image, for a <source> ahead of next/image's <img>.
 *
 * ImageKit's `f-auto` does NOT serve AVIF on this account — measured: with
 * `Accept: image/avif,image/webp` it answers WebP, and with `Accept: image/avif`
 * alone it answers JPEG. It is an account-level setting, off by default, and
 * `f-auto` is honest about only doing what the account allows. Asking for
 * `f-avif` explicitly does work, and is worth asking for:
 *
 *   backdrop w1200 q65   WebP 33.1 KB -> AVIF 17.8 KB  (-46%)
 *   poster   w500  q70   WebP 86.0 KB -> AVIF 74.7 KB  (-13%)
 *
 * A hard `f-avif` on the <img> itself would be a compatibility bet — pre-2022
 * Safari and Android would get bytes they cannot decode and fall down
 * BlurredImage's error chain to a whole second request on another host. A
 * <source type="image/avif"> is not a bet: the browser reads the type, and a
 * browser that can't decode AVIF never requests it. No error path, no wasted
 * fetch, no UA sniffing.
 *
 * Widths above the source are dropped rather than clamped — clamping produces
 * several identical URLs under different `w` descriptors, which invites the
 * browser to pick a 2560w-labelled candidate that is really 500px wide.
 */
export function avifSrcSet(src: string, quality?: number) {
  if (!isImageKitURL(src)) return undefined
  const max = sourceWidth(src)
  const widths = CANDIDATE_WIDTHS.filter((w) => w < max)
  widths.push(max)
  return widths
    .map((w) => `${buildURL({ src, width: w, quality, format: 'avif' })} ${w}w`)
    .join(', ')
}
