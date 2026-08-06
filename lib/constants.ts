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

// How many slides the homepage hero carries. The rails got capped for page
// weight and the hero never did, even though it is the more expensive of the two
// per item: every slide ships a full TMDB object in the RSC flight payload AND
// costs a build-time TMDB request of its own to resolve its trailer + title logo
// (services/hero-extras.ts). The carousel renders a 3-slide window and it is a
// homepage banner, not a catalogue — the tail of a 20-slide deck was paid for on
// every single load and reached by nobody. 12 matches RAIL_LIMIT: still a 40%
// cut, and it leaves the deck long enough to keep browsing rather than trimming
// it to the few slides a median visitor sees.
const HERO_LIMIT = 12

export {
  TOP_OFFSET,
  STREAMING_MOVIES_API_URL,
  SEARCH_ACTOR_GOOGLE,
  SEARCH_DEBOUNCE,
  IMAGE_CACHE_HOST_URL,
  RAIL_LIMIT,
  HERO_LIMIT,
}
