import { IMAGE_CACHE_HOST_URL } from './constants'

const apiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_TMDB_BASEURL,
  apiKey: process.env.TMDB_API_KEY,
  headerKey: process.env.TMDB_HEADER_KEY,
  // On-the-fly ImageKit optimization. URL transforms are enabled by default on
  // every ImageKit account and produce the *same image* (resized + WebP) rather
  // than a different one — so the <img>/<Image> is byte-for-byte identical in
  // content, just dramatically smaller. A full-width TMDB backdrop is typically
  // 1–3 MB; tr:w-2000,q-82,f-webp brings the LCP hero to ~200–280 KB. The hero
  // is full-bleed object-cover and Ken-Burns-scaled to 1.16×, so on a 1440p/4K
  // or retina panel it paints well past 1600px — w-2000 keeps it crisp there
  // (1600 visibly upscaled/pixelated). Quality is q-82 (posters) / q-80 (thumbs):
  // WebP at q-82 is effectively visually lossless on poster faces/text while
  // still ~40% smaller than the JPEG origin — q-70/72 was over-soft. If a
  // transform ever 404s, the onError chain in BlurredImage walks to wsrv.nl
  // (also optimized) then TMDB origin — so this can never break an image, only
  // fail back to the (still-working) unoptimized.
  originalImage: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:w-2000,q-82,f-webp,pr-true/original${imgPath}`,
  w500Image: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:q-82,f-webp/w500${imgPath}`,
  w185Image: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:q-80,f-webp/w185${imgPath}`,
  w300Image: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/tr:q-80,f-webp/w300${imgPath}`,
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
// width, so cap it at 2000 (matches the ImageKit hero width above — the largest
// the full-bleed hero renders at 1.16× scale on hi-dpi panels). Used so the
// wsrv.nl fallback can re-apply the SAME optimization instead of either
// upscaling thumbnails (w=2000 on a /w185 path) or serving the full multi-MB
// original.
function widthFromPath(path: string): number | undefined {
  const m = path.match(/^\/(?:original|w(\d+))/)
  if (!m) return undefined
  if (m[1]) return Number(m[1])
  return 2000 // /original
}

// Given the current (failed) image URL, return the next fallback in the chain,
// or null when exhausted (already at TMDB origin, or not one of our URLs).
// Each stage stays OPTIMIZED (resized + WebP) so a fallback never regresses to
// a multi-megabyte origin image — it just degrades in resilience, not bytes.
function getNextImageFallback(src: unknown): string | null {
  if (typeof src !== 'string') return null
  const path = extractTMDBPath(src)
  if (!path) return null
  const tmdbOrigin = `${TMDB_ORIGIN_IMAGE_BASE}${path}`
  switch (imageStage(src)) {
    case 0: {
      // ImageKit -> wsrv.nl (still optimized: width+quality+WebP).
      // TMDB image paths are clean (no query string), so the origin URL can go
      // unencoded in wsrv's ?url= — which keeps the `image.tmdb.org/t/p` marker
      // literal so the NEXT stage's extractTMDBPath can still find it.
      const w = widthFromPath(path)
      const widthParam = w ? `&w=${w}` : ''
      return `${WSRV_BASE}${tmdbOrigin}${widthParam}&q=82&output=webp`
    }
    case 1: // wsrv.nl -> TMDB origin direct (last resort, unoptimizable)
      return tmdbOrigin
    default: // origin (2) is the last resort, or unknown host
      return null
  }
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

export { apiConfig, movieType, tvType, getNextImageFallback }
