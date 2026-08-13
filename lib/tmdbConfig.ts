import { IMAGE_CACHE_HOST_URL } from './constants'

// Read lazily, NOT captured at module init. cloudflare/worker.js copies the
// Worker's secrets onto `process.env` when a request arrives, which is after
// this module has already been evaluated — eager fields would have frozen the
// undefined values from module scope and every TMDB call would go out keyless.
// Next still inlines `process.env.NEXT_PUBLIC_*` textually inside a getter.
const apiConfig = {
  get baseUrl() {
    return process.env.NEXT_PUBLIC_TMDB_BASEURL
  },
  get apiKey() {
    return process.env.TMDB_API_KEY
  },
  get headerKey() {
    return process.env.TMDB_HEADER_KEY
  },
  // On-the-fly ImageKit optimization. URL transforms are enabled by default on
  // every ImageKit account and produce the *same image* (resized + WebP) rather
  // than a different one — so the <img>/<Image> is byte-for-byte identical in
  // content, just dramatically smaller. A full-width TMDB backdrop is typically
  // 1–3 MB; tr:w-2560,q-82,f-auto brings the LCP hero to ~300–420 KB (AVIF). The
  // details hero is full-bleed object-cover at 100dvh, so on a 2560px monitor or
  // a 1440p/retina panel the backdrop paints edge-to-edge at up to ~2560 CSS px —
  // w-2000 was visibly upscaled/soft there, w-2560 renders it crisp at native
  // width. Quality is q-82 (posters) / q-80 (thumbs):
  // WebP at q-82 is effectively visually lossless on poster faces/text while
  // still ~40% smaller than the JPEG origin — q-70/72 was over-soft. If a
  // transform ever 404s, the onError chain in BlurredImage walks to wsrv.nl
  // (also optimized) then TMDB origin — so this can never break an image, only
  // fail back to the (still-working) unoptimized.
  //
  // `f-auto` (not a hard f-webp) so ImageKit negotiates the format from the
  // request's Accept header — it does set `Vary: Accept`, so this is honest
  // content negotiation and safe to cache.
  //
  // It does NOT reach AVIF, though, and the comment here used to claim it did.
  // Measured against this endpoint: `Accept: image/avif,image/webp` gets WebP
  // back, and `Accept: image/avif` alone gets JPEG. AVIF is an account-level
  // setting in the ImageKit dashboard, off by default, and f-auto only offers
  // what the account allows. Until that is switched on, AVIF is obtained by
  // asking for it by name — see avifSrcSet in lib/image-loader.ts, which puts it
  // on a <source> so no browser is ever handed bytes it can't decode. Switching
  // the account setting on is strictly better and would make that redundant;
  // it costs nothing to leave in place either way.
  //
  // The q-82 baked in below is only the URL's default. Everything rendered
  // through BlurredImage overrides it (65 backdrops / 70 posters) via the
  // loader; what is left on 82 is the hero's transparent title logo.
  // The wsrv.nl fallback stays webp.
  // `c-at_max` = fit inside the requested box, never enlarge. TMDB's `original`
  // is not a width — plenty of backdrops are natively 1280 or 780 px — and
  // without this ImageKit upscales one to whatever w- it is handed, which is
  // more bytes for strictly no more detail. Measured on a 780 px source asked
  // for w-2560: 30,060 B upscaled against 6,054 B at its native width, and the
  // browser was going to stretch it to the same painted size either way. A
  // source that IS bigger is unaffected (the 3840 px original returned an
  // identical 55,044 B / 2560x1440 with and without it). Same fix as `&we` on
  // the wsrv stage — the fallback got it first, this is the path everyone
  // actually loads.
  originalImage: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:w-2560,q-82,f-auto,pr-true,c-at_max/original${imgPath}`,
  w500Image: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:q-82,f-auto/w500${imgPath}`,
  // The hero's title wordmark. It is the ONE image on the site that renders as a
  // plain <img>, so next/image's loader never sees it and the q-82 above stands
  // — which made the two visible logos the two heaviest files on the homepage
  // (31 KB + 29 KB of a 247 KB cold load, 28% of all image bytes).
  //
  // Only the quality is lowered, deliberately. Width looks like the bigger lever
  // (w-500 -> w-320 is -42% against q-82 -> q-70's -12%) and it is a trap: the
  // logo is `w-auto` under a `max-h`/`max-w` cap, so above the lg breakpoint
  // NEITHER cap binds and the element lays out at the file's intrinsic width —
  // measured at 1512px, a logo painted at exactly 500 CSS px. Serving a narrower
  // file would not sharpen anything, it would visibly shrink the wordmark. Below
  // lg the height cap binds and the extra pixels are real detail on a dpr-2
  // phone, which needs ~560 for a box the 500px source can only just fill.
  logoImage: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:q-70,f-auto,c-at_max/w500${imgPath}`,
  w185Image: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:q-80,f-auto/w185${imgPath}`,
  w300Image: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:q-80,f-auto/w300${imgPath}`,
}

// TMDB's own image origin — free, keyless, unmetered, never expires. The last
// resort in the fallback chain so images can never all break at once.
const TMDB_ORIGIN_IMAGE_BASE = 'https://image.tmdb.org/t/p'
// wsrv.nl — free, keyless Cloudflare-backed image proxy/optimizer. Second in the
// chain: still optimizes (WebP) when ImageKit is down, before we drop to origin.
const WSRV_BASE = 'https://wsrv.nl/?url='

// Image source fallback chain, tried in order on each onError:
//   0. ImageKit (IMAGE_CACHE_HOST_URL) — primary, our paid/managed CDN
//   1. wsrv.nl proxying the TMDB origin — free optimizer if ImageKit is down
//   2. TMDB origin direct — free/keyless final safety net
// Every stage's URL embeds the same TMDB path (e.g. "/w500/abc.jpg"), so we can
// recover it from any stage and rebuild the next one.

// Pull the TMDB path (including its /original or /w500 size segment) out of any
// stage's URL — ImageKit (with or without a tr:... transform prefix), wsrv `?url=`,
// or origin. null when `src` isn't one of ours, so callers leave it untouched.
function extractTMDBPath(src: string): string | null {
  if (IMAGE_CACHE_HOST_URL && src.startsWith(IMAGE_CACHE_HOST_URL)) {
    // ImageKit URLs look like "<host>/tr:w-1600,q-72,f-webp/original/abc.jpg" or
    // "<host>/w500/abc.jpg". Strip the host and any leading tr: transform segment
    // to recover the bare "/<size>/<file>" path the rest of the chain expects.
    let rest = src.slice(IMAGE_CACHE_HOST_URL.length)
    const trIdx = rest.indexOf('tr:')
    if (trIdx !== -1) {
      // Skip "tr:...." up to the first '/' that begins the size segment.
      const afterTr = rest.indexOf('/', trIdx)
      if (afterTr !== -1) rest = rest.slice(afterTr)
    }
    return rest
  }
  const marker = 'image.tmdb.org/t/p'
  const idx = src.indexOf(marker)
  if (idx === -1) return null
  let rest = src.slice(idx + marker.length)
  // Strip any trailing wsrv params (e.g. "&output=webp") after the path.
  const amp = rest.indexOf('&')
  if (amp !== -1) rest = rest.slice(0, amp)
  return rest
}

// Which stage a URL is currently at (-1 = not one of ours).
function imageStage(src: string): number {
  if (IMAGE_CACHE_HOST_URL && src.startsWith(IMAGE_CACHE_HOST_URL)) return 0
  if (src.startsWith(WSRV_BASE)) return 1
  if (src.startsWith(TMDB_ORIGIN_IMAGE_BASE)) return 2
  return -1
}

// Pull the pixel width the source image was requested at, from its TMDB size
// segment ("/original", "/w500", "/w300", "/w185"). `original` has no fixed
// width, so cap it at 2560 (matches the ImageKit hero width above — the largest
// the full-bleed 100dvh hero paints at on a 2560px/retina panel). Used so the
// wsrv.nl fallback can re-apply the SAME optimization instead of either
// upscaling thumbnails (w=2000 on a /w185 path) or serving the full multi-MB
// original.
function widthFromPath(path: string): number | undefined {
  const m = path.match(/^\/(?:original|w(\d+))/)
  if (!m) return undefined
  if (m[1]) return Number(m[1])
  return 2560 // /original — matches the ImageKit hero width above
}

// wsrv has no AVIF saver ("Saving to avif is disabled. Supported savers: jpg,
// png, webp, tiff, gif, json, jxl"), so the fallback tops out at WebP. That
// costs bytes, not pixels: at the SAME width and quality wsrv and ImageKit hand
// back byte-identical WebP (measured — w1200 q65 of the same backdrop was 10678
// bytes from both, q82 was 18252 from both). Which is the point worth holding
// on to: this chain has never had a quality problem it did not give itself by
// asking for the wrong width.
//
// Default quality matches BlurredImage's poster setting. It is only what a bare
// URL carries — every image rendered through next/image goes back through
// lib/image-loader.ts, which rewrites `w` and `q` per candidate.
const WSRV_DEFAULT_QUALITY = 70

/**
 * Build the wsrv.nl stage for a TMDB path (e.g. "/w500/abc.jpg").
 *
 * `&we` = "without enlargement", and it is the whole reason the fallback used to
 * look bad. `widthFromPath` maps `/original` to 2560 because that is what the
 * ImageKit hero asks for, but TMDB's `original` is not a width — plenty of
 * backdrops are only 1280 or 780 px wide, and wsrv will cheerfully upscale one
 * to whatever it is asked for. Measured on a w780 source asked for w=2560:
 * 45.8 KB of soft, upscaled mush, against 10.1 KB for the same request with
 * `&we` (which returns the native 780 px and lets the browser do the stretching,
 * if any). Blurrier AND four times the bytes.
 *
 * TMDB image paths are clean (no query string), so the origin URL goes
 * unencoded in wsrv's `?url=` — which keeps the `image.tmdb.org/t/p` marker
 * literal so extractTMDBPath can still find it on the way to the next stage.
 */
function buildWsrvURL(path: string, width?: number, quality?: number) {
  const w = width ?? widthFromPath(path)
  const widthParam = w ? `&w=${w}` : ''
  const q = quality ?? WSRV_DEFAULT_QUALITY
  return `${WSRV_BASE}${TMDB_ORIGIN_IMAGE_BASE}${path}${widthParam}&q=${q}&output=webp&we`
}

// Given the current (failed) image URL, return the next fallback in the chain,
// or null when exhausted (already at TMDB origin, or not one of our URLs).
// Each stage stays OPTIMIZED (resized + WebP) so a fallback never regresses to
// a multi-megabyte origin image — it just degrades in resilience, not bytes.
function getNextImageFallback(src: unknown): string | null {
  if (typeof src !== 'string') return null
  const path = extractTMDBPath(src)
  if (!path) return null
  switch (imageStage(src)) {
    case 0: // ImageKit -> wsrv.nl (still optimized: width+quality+WebP)
      return buildWsrvURL(path)
    case 1: // wsrv.nl -> TMDB origin direct (last resort, unoptimizable)
      return `${TMDB_ORIGIN_IMAGE_BASE}${path}`
    default: // origin (2) is the last resort, or unknown host
      return null
  }
}

/** Is this URL still on the primary (ImageKit) host? */
function isPrimaryImageURL(src: unknown): boolean {
  return typeof src === 'string' && imageStage(src) === 0
}

/** Is this URL the wsrv.nl stage? (the loader rewrites those too) */
function isWsrvURL(src: string): boolean {
  return src.startsWith(WSRV_BASE)
}

// --- primary-host circuit breaker --------------------------------------------
//
// ImageKit running out of quota is not one broken image, it is every image on
// every page for the rest of the month. Walking the chain per-<img> handles the
// pixels but not the cost: each one pays a doomed request before it can start
// the one that works, the hero's `<link rel=preload imagesrcset>` names a URL
// that will 4xx, and a list scroll doubles its request count.
//
// So enough failures on the primary host flip a flag and every image that has
// not painted yet re-renders straight onto the fallback. Deliberately NOT
// persisted: a fresh tab probes ImageKit once more, which is also how the site
// notices the quota has reset without anyone shipping a deploy.
//
// THREE distinct URLs, not one. The first cut tripped on a single `error` event
// and that was measured to be a disaster: dispatching one error on one poster
// moved 17 of 20 images on the homepage to wsrv — all of them already painted
// from ImageKit and sitting in the HTTP cache. Every one re-downloaded from a
// cold host and replayed its blur-up, which reads exactly like "the images went
// blank on refresh and nothing is cached". And `error` fires for far more than
// a dead host: one poster TMDB no longer has, a request aborted by navigating
// away, a content blocker's rule, a flaky connection. A host that is genuinely
// out of quota fails every image, so it reaches three in the first screenful;
// nothing else does.
const PRIMARY_FAILURE_THRESHOLD = 3
let primaryImageHostDown = false
const failedPrimaryURLs = new Set<string>()
const primaryImageHostSubs = new Set<() => void>()

function markPrimaryImageHostDown(src: unknown) {
  if (primaryImageHostDown) return
  // Only a failure ON the primary is evidence about the primary — a wsrv or
  // origin URL erroring says nothing about ImageKit.
  if (typeof src !== 'string' || !isPrimaryImageURL(src)) return
  // Distinct URLs: one image retrying itself is one piece of evidence, not N.
  failedPrimaryURLs.add(src)
  if (failedPrimaryURLs.size < PRIMARY_FAILURE_THRESHOLD) return
  primaryImageHostDown = true
  primaryImageHostSubs.forEach((notify) => notify())
}

function subscribePrimaryImageHost(notify: () => void) {
  primaryImageHostSubs.add(notify)
  return () => {
    primaryImageHostSubs.delete(notify)
  }
}

function isPrimaryImageHostDown() {
  return primaryImageHostDown
}

/**
 * Skip the primary stage for a URL that has not failed *yet*, once we know the
 * primary is down. A no-op until the breaker trips, and anything already past
 * stage 0 is returned untouched — this never rewinds an image that has walked
 * further down the chain.
 */
function demoteFromPrimary<T>(src: T): T | string {
  if (!primaryImageHostDown) return src
  if (!isPrimaryImageURL(src)) return src
  return getNextImageFallback(src) ?? src
}

/**
 * Shared `onError` for a plain <img>/next-image that renders one of our URLs:
 * advance one stage, and record a primary-host failure so the rest of the page
 * stops trying it. Used by every image that is not a BlurredImage.
 */
function handleImageFallbackError(el: HTMLImageElement | null) {
  if (!el) return
  const current = el.src
  markPrimaryImageHostDown(current)
  const next = getNextImageFallback(current)
  if (next && next !== current) el.src = next
}

// old
// originalImage: (imgPath: string) =>
// `https://image.tmdb.org/t/p/original${imgPath}`,
// w500Image: (imgPath: string) => `https://image.tmdb.org/t/p/w500${imgPath}`,

const movieType = {
  upcoming: 'upcoming',
  popular: 'popular',
  top_rated: 'top_rated',
  now_playing: 'now_playing',
  trending: 'trending',
}

const tvType = {
  popular: 'popular',
  top_rated: 'top_rated',
  on_the_air: 'on_the_air',
  trending: 'trending',
}

export {
  apiConfig,
  movieType,
  tvType,
  getNextImageFallback,
  buildWsrvURL,
  extractTMDBPath,
  isPrimaryImageURL,
  isWsrvURL,
  demoteFromPrimary,
  handleImageFallbackError,
  markPrimaryImageHostDown,
  subscribePrimaryImageHost,
  isPrimaryImageHostDown,
}
