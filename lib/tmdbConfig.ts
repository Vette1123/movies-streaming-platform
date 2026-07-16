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

// TMDB's own image origin — free, keyless, unmetered, never expires. We proxy
// through IMAGE_CACHE_HOST_URL (ImageKit) for speed/caching, but keep this as a
// safety net so a lapsed/dead CDN never leaves the site with broken images.
const TMDB_ORIGIN_IMAGE_BASE = 'https://image.tmdb.org/t/p'

// Given a CDN (ImageKit) image URL, return the equivalent TMDB-origin URL to use
// as an onError fallback. The proxy path mirrors TMDB exactly
// (`${HOST}/original/x.jpg` <-> `${TMDB}/original/x.jpg`), so a prefix swap is
// enough. Returns null when `src` isn't one of our CDN URLs (external hosts,
// already-origin URLs) so callers leave those untouched.
function getTMDBOriginFallback(src: unknown): string | null {
  if (!IMAGE_CACHE_HOST_URL || typeof src !== 'string') return null
  if (!src.startsWith(IMAGE_CACHE_HOST_URL)) return null
  return src.replace(IMAGE_CACHE_HOST_URL, TMDB_ORIGIN_IMAGE_BASE)
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

export { apiConfig, movieType, tvType, getTMDBOriginFallback }
