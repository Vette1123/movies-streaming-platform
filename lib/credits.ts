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
