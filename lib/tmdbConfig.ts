/**
 * What an image builder returns when TMDB has no image to point at.
 *
 * Every builder below interpolates its argument straight into a template
 * literal, and every one is typed `string` — so a `null` from TMDB (which is
 * what `backdrop_path`, `poster_path` and `logo_path` are whenever a title has
 * no art) stringifies into the URL instead of being rejected by the type.
 * `/original` + `null` is `/originalnull`, and Cloudflare logged 22 requests a
 * day for exactly that path, sitting in the unclassified 4xx column next to the
 * credential scanners. Each one also walked the whole onError fallback chain in
 * BlurredImage, so one missing poster cost a 404 on every stage.
 *
 * Most call sites do guard. The guard belongs here anyway, because "most" is
 * the problem: nine call sites pass one of these paths and the type system
 * cannot tell the guarded ones from the rest. A transparent 1x1 GIF costs no
 * request at all, and `buildURL` in lib/image-loader.ts returns any src it
 * cannot match as-is, so a data URI passes through the loader untouched.
 */
const EMPTY_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** Falsy TMDB path in, transparent pixel out; anything else is built normally. */
const withImagePath = (
  imgPath: string | null | undefined,
  build: (path: string) => string
) => (imgPath ? build(imgPath) : EMPTY_PIXEL)

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
  // Every image starts on wsrv.nl: free, keyless, Cloudflare-cached for a year,
  // with no monthly bandwidth to run out of. A metered host cannot be primary
  // here: a prerendered page cannot walk BlurredImage's onError chain until it
  // has hydrated, so a spent quota leaves the whole first screen on failed images
  // (ImageKit, 2026-10-30, LCP 6.7s on prod).
  //
  // Two of these are read bare, without the loader: `originalImage` by the OG and
  // Twitter tags and the Worker's metadata, `w500Image` by the image sitemap and
  // JSON-LD. Their consumers do not all decode WebP, so they keep the source
  // format, and the 2560 is an unfurl width, not the page's ceiling. Everything
  // on a page goes through lib/image-loader.ts, which sets the width, the
  // quality (65 backdrops / 70 posters) and WebP per candidate.
  originalImage: (imgPath: string | null | undefined) =>
    withImagePath(imgPath, (path) =>
      buildWsrvURL(`/original${path}`, 2560, 82, null)
    ),
  w500Image: (imgPath: string | null | undefined) =>
    withImagePath(imgPath, (path) =>
      buildWsrvURL(`/w500${path}`, undefined, undefined, null)
    ),
  // The hero's title wordmark. It renders as a plain <img>, so the loader never
  // sees it and its width and quality are chosen here. Read from `/original` so
  // getLogoImageSrcSet can hand out real widths; `&we` keeps a small source from
  // being enlarged, and the largest file is only fetched by a screen that can
  // show it.
  logoImage: (imgPath: string | null | undefined, width = 500) =>
    withImagePath(imgPath, (path) =>
      buildWsrvURL(`/original${path}`, width, 70)
    ),
  w185Image: (imgPath: string | null | undefined) =>
    withImagePath(imgPath, (path) =>
      buildWsrvURL(`/w185${path}`, undefined, 80)
    ),
  w300Image: (imgPath: string | null | undefined) =>
    withImagePath(imgPath, (path) =>
      buildWsrvURL(`/w300${path}`, undefined, 80)
    ),
}

// TMDB's own image origin — free, keyless, unmetered, never expires. The last
// resort in the fallback chain so images can never all break at once.
const TMDB_ORIGIN_IMAGE_BASE = 'https://image.tmdb.org/t/p'
// wsrv.nl — free, keyless Cloudflare-backed image proxy/optimizer. Primary.
const WSRV_BASE = 'https://wsrv.nl/?url='

// Image source fallback chain, tried in order on each onError:
//   0. wsrv.nl proxying the TMDB origin — resized, WebP
//   1. TMDB origin direct — free/keyless final safety net
// Both stages' URLs embed the same TMDB path (e.g. "/w500/abc.jpg"), so we can
// recover it from either and rebuild the next one.

// Pull the TMDB path (including its /original or /w500 size segment) out of a
// wsrv `?url=` or origin URL. null when `src` isn't one of ours, so callers leave
// it untouched.
function extractTMDBPath(src: string): string | null {
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
  if (src.startsWith(WSRV_BASE)) return 0
  if (src.startsWith(TMDB_ORIGIN_IMAGE_BASE)) return 1
  return -1
}

// Pull the pixel width the source image was requested at, from its TMDB size
// segment ("/original", "/w500", "/w300", "/w185"). `original` has no fixed
// width, so cap it at the loader's ceiling. Used so a bare wsrv URL carries the
// right optimization instead of either
// upscaling thumbnails (w=2000 on a /w185 path) or serving the full multi-MB
// original.
function widthFromPath(path: string): number | undefined {
  const m = path.match(/^\/(?:original|w(\d+))/)
  if (!m) return undefined
  if (m[1]) return Number(m[1])
  // /original — the same ceiling `ORIGINAL_MAX_WIDTH` sets in
  // lib/image-loader.ts (see there for the bytes-per-width measurement). The
  // two must move together or the fallback stage stops matching the primary.
  return 3072
}

// Default quality matches BlurredImage's poster setting. It is only what a bare
// URL carries — every image rendered through next/image goes back through
// lib/image-loader.ts, which rewrites `w` and `q` per candidate.
const WSRV_DEFAULT_QUALITY = 70

/**
 * Build the wsrv.nl stage for a TMDB path (e.g. "/w500/abc.jpg").
 *
 * `&we` = "without enlargement". `widthFromPath` maps `/original` to the width
 * ceiling, but TMDB's `original` is not a width — plenty of
 * backdrops are only 1280 or 780 px wide, and wsrv will cheerfully upscale one
 * to whatever it is asked for. Measured on a w780 source asked for w=2560:
 * 45.8 KB of soft, upscaled mush, against 10.1 KB for the same request with
 * `&we` (which returns the native 780 px and lets the browser do the stretching,
 * if any). Blurrier AND four times the bytes.
 *
 * `&default=1` makes wsrv answer a failed fetch with a redirect to the TMDB
 * origin. That recovery needs no JavaScript, so unlike BlurredImage's onError
 * chain it also works on the prerendered first screen.
 *
 * TMDB image paths are clean (no query string), so the origin URL goes
 * unencoded in wsrv's `?url=` — which keeps the `image.tmdb.org/t/p` marker
 * literal so extractTMDBPath can still find it on the way to the next stage.
 */
function buildWsrvURL(
  path: string,
  width?: number,
  quality?: number,
  output: 'webp' | 'jpg' | null = 'webp'
) {
  const w = width ?? widthFromPath(path)
  const widthParam = w ? `&w=${w}` : ''
  const q = quality ?? WSRV_DEFAULT_QUALITY
  const outputParam = output ? `&output=${output}` : ''
  return `${WSRV_BASE}${TMDB_ORIGIN_IMAGE_BASE}${path}${widthParam}&q=${q}${outputParam}&we&default=1`
}

/**
 * A tiny blurred copy of a backdrop as a data URI, ~300 bytes, for the hero to
 * paint before its real image arrives. Fetched at build and inlined.
 */
function buildWsrvPlaceholderURL(imgPath: string) {
  return `${buildWsrvURL(`/w300${imgPath}`, 24, 30)}&blur=1&encoding=base64`
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
    case 0: // wsrv.nl -> TMDB origin direct (last resort, unoptimizable)
      return `${TMDB_ORIGIN_IMAGE_BASE}${path}`
    default: // origin (1) is the last resort, or unknown host
      return null
  }
}

/** Is this URL still on the primary (wsrv) host? */
function isPrimaryImageURL(src: unknown): boolean {
  return typeof src === 'string' && imageStage(src) === 0
}

/** Is this URL the wsrv.nl stage? (the only one the loader can rewrite) */
function isWsrvURL(src: string): boolean {
  return src.startsWith(WSRV_BASE)
}

// --- primary-host circuit breaker --------------------------------------------
//
// wsrv going down is not one broken image, it is every image on every page.
// Walking the chain per-<img> handles the pixels but not the cost: each one pays
// a doomed request before the one that works. So enough failures on the primary
// host flip a flag and every image that has not painted yet re-renders straight
// onto the origin. Deliberately NOT persisted: a fresh tab probes wsrv again.
//
// THREE distinct URLs, not one. `error` fires for far more than a dead host: a
// poster TMDB no longer has, a request aborted by navigating away, a content
// blocker, a flaky connection. Tripping on one was measured to move 17 of 20
// already-painted homepage images to a cold host, which reads exactly like
// "the images went blank on refresh". A dead host fails every image, so it
// reaches three in the first screenful; nothing else does.
const PRIMARY_FAILURE_THRESHOLD = 3
let primaryImageHostDown = false
const failedPrimaryURLs = new Set<string>()
const primaryImageHostSubs = new Set<() => void>()

function markPrimaryImageHostDown(src: unknown) {
  if (primaryImageHostDown) return
  // Only a failure ON the primary is evidence about the primary.
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
  buildWsrvPlaceholderURL,
  extractTMDBPath,
  isPrimaryImageURL,
  isWsrvURL,
  demoteFromPrimary,
  handleImageFallbackError,
  markPrimaryImageHostDown,
  subscribePrimaryImageHost,
  isPrimaryImageHostDown,
}
