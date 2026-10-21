const TOP_OFFSET = 60
const STREAMING_MOVIES_API_URL =
  process.env.NEXT_PUBLIC_STREAMING_MOVIES_API_URL
const STREAMING_MOVIES_API_QUERY =
  process.env.NEXT_PUBLIC_STREAMING_MOVIES_API_QUERY
const SEARCH_ACTOR_GOOGLE = process.env.NEXT_PUBLIC_SEARCH_ACTOR_GOOGLE
// Forced to https, whatever the env says. Production's value arrived as
// `http://ik.imagekit.io/...`, and on an HTTPS page a plain-http image is
// BLOCKED as mixed content — measured on the live homepage: 213 dead requests,
// zero bytes each, and every image then walking BlurredImage's error chain down
// to wsrv (WebP instead of AVIF, a second host, after a failure the browser had
// to wait for). The posters still appeared, which is why nothing looked broken;
// they just all arrived late. One normalisation here is cheaper than trusting
// every deploy secret to carry a scheme.
const IMAGE_CACHE_HOST_URL =
  process.env.NEXT_PUBLIC_IMAGE_CACHE_HOST_URL?.replace(
    /^http:\/\//,
    'https://'
  )
const SEARCH_DEBOUNCE = 400
// How many items any poster rail carries: the homepage rows and the
// similar/recommended rows on a detail page. They're horizontal scrollers, so
// 12 fills them, and TMDB's full 20-item page just adds markup plus a second
// copy of each item in the RSC flight payload — the biggest single lever on
// page weight.
const RAIL_LIMIT = 12

// How many slides the homepage hero carries.
//
// 6, not 12. The deck is a BANNER, not a catalogue: the carousel renders a
// 3-slide window, the indicator row shows one dot per slide, and at 12 the
// dots overflowed into an ellipsis on a phone ("1 / 12" with eight dots and a
// "…"). Half the deck also meant half the flight payload, half the
// build-time trailer/logo lookups (services/hero-extras.ts), and a longer
// stretch of the same day's trending before a visitor saw something they had
// not seen - which is what made it read as stale.
//
// 6 still leaves a visitor something to swipe through, and the dots fit.
const HERO_LIMIT = 12

export {
  TOP_OFFSET,
  STREAMING_MOVIES_API_URL,
  STREAMING_MOVIES_API_QUERY,
  SEARCH_ACTOR_GOOGLE,
  SEARCH_DEBOUNCE,
  IMAGE_CACHE_HOST_URL,
  RAIL_LIMIT,
  HERO_LIMIT,
}
