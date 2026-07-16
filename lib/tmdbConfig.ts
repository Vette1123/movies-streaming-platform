import { IMAGE_CACHE_HOST_URL } from './constants'

const apiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_TMDB_BASEURL,
  apiKey: process.env.TMDB_API_KEY,
  headerKey: process.env.TMDB_HEADER_KEY,
  originalImage: (imgPath: string) =>
    `${IMAGE_CACHE_HOST_URL}/original${imgPath}`,
  w500Image: (imgPath: string) => `${IMAGE_CACHE_HOST_URL}/w500${imgPath}`,
  w185Image: (imgPath: string) => `${IMAGE_CACHE_HOST_URL}/w185${imgPath}`,
  w300Image: (imgPath: string) => `${IMAGE_CACHE_HOST_URL}/w300${imgPath}`,
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

// Pull the TMDB path out of any stage's URL (ImageKit prefix, wsrv `?url=`, or
// origin). null when `src` isn't one of ours, so callers leave it untouched.
function extractTMDBPath(src: string): string | null {
  if (IMAGE_CACHE_HOST_URL && src.startsWith(IMAGE_CACHE_HOST_URL)) {
    return src.slice(IMAGE_CACHE_HOST_URL.length)
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

// Given the current (failed) image URL, return the next fallback in the chain,
// or null when exhausted (already at TMDB origin, or not one of our URLs).
function getNextImageFallback(src: unknown): string | null {
  if (typeof src !== 'string') return null
  const path = extractTMDBPath(src)
  if (!path) return null
  const tmdbOrigin = `${TMDB_ORIGIN_IMAGE_BASE}${path}`
  switch (imageStage(src)) {
    case 0: // ImageKit -> wsrv.nl (optimized)
      return `${WSRV_BASE}${tmdbOrigin}&output=webp`
    case 1: // wsrv.nl -> TMDB origin direct
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
