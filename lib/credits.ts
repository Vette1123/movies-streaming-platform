import type { Credit } from '@/types/credit'

/**
 * Names off a TMDB credits block, for structured data.
 *
 * Both detail pages need the same two lists — the billed cast and whoever
 * directed it — and both already hold the credits object the page renders its
 * cast rail from, so this costs nothing but the mapping.
 *
 * Capped: schema.org has no limit but a page does. Ten names is the whole
 * billed cast of most films and all of the entity signal there is to gain; the
 * eleventh is bytes in every prerendered detail page for nothing.
 */
const CAST_LIMIT = 10

export const castNames = (
  credits: Credit | undefined,
  limit = CAST_LIMIT
): string[] =>
  (credits?.cast ?? [])
    // TMDB returns billing order, but not reliably sorted — the rail sorts it
    // too. Sorting here keeps the schema and the visible list in agreement.
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, limit)
    .map((person) => person.name)
    .filter(Boolean)

export const crewNamesByJob = (
  credits: Credit | undefined,
  job: string,
  limit = 3
): string[] => {
  const names = (credits?.crew ?? [])
    .filter((person) => person.job === job && person.name)
    .map((person) => person.name)
  return [...new Set(names)].slice(0, limit)
}

/**
 * The credits block reduced to what the site actually renders.
 *
 * TMDB's `credits` append is 71 KB of the 100 KB it answers for a film — 50 KB
 * of that is a 188-person crew, of which the pages read exactly one job. The
 * cast rail and the schema.org list both stop at ten.
 *
 * This does NOT change a prerendered page: both detail pages render credits on
 * the server, so the extra people never reached a browser from there (measured
 * — the HTML is byte-for-byte the same size). What it changes is /api/media/*,
 * which is how the tail-id shell gets its payload and, at 3.66ms average, the
 * most expensive route the Worker serves: it parses TMDB's 100 KB, then
 * re-serializes what is left, caches that, and sends it. Measured on
 * /api/media/movie/550 against production: 88,962 bytes before, 20,499 after.
 * (An older comment in services/movies.ts puts that payload at 28 KB — that
 * number is wrong for a film with a full crew; the 71 KB credits block is most
 * of it.)
 *
 * Sorted by billing order, because both readers of the trimmed list assume it:
 * the rail slices the first ten as given, `castNames` sorts before it slices,
 * and they must not disagree about who the tenth person is.
 */
export const trimCredits = (
  credits: Credit | undefined,
  id: number
): Credit => ({
  id: credits?.id ?? id,
  cast: (credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, CAST_LIMIT),
  // The only job either detail page looks up. Keep every match rather than the
  // first: a co-directed film names both, and crewNamesByJob dedupes anyway.
  crew: (credits?.crew ?? []).filter((person) => person.job === 'Director'),
})
