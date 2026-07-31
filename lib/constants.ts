const TOP_OFFSET = 60
const STREAMING_MOVIES_API_URL =
  process.env.NEXT_PUBLIC_STREAMING_MOVIES_API_URL
const SEARCH_ACTOR_GOOGLE = process.env.NEXT_PUBLIC_SEARCH_ACTOR_GOOGLE
const IMAGE_CACHE_HOST_URL = process.env.NEXT_PUBLIC_IMAGE_CACHE_HOST_URL
const SEARCH_DEBOUNCE = 400
// How many items any poster rail carries: the homepage rows and the
// similar/recommended rows on a detail page. They're horizontal scrollers, so
// 12 fills them, and TMDB's full 20-item page just adds markup plus a second
// copy of each item in the RSC flight payload — the biggest single lever on
// page weight.
const RAIL_LIMIT = 12

export {
  TOP_OFFSET,
  STREAMING_MOVIES_API_URL,
  SEARCH_ACTOR_GOOGLE,
  SEARCH_DEBOUNCE,
  IMAGE_CACHE_HOST_URL,
  RAIL_LIMIT,
}
