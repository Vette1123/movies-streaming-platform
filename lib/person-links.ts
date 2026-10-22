import { getPeopleWithPages } from '@/services/people'

/**
 * Which cast members this build actually has a page for.
 *
 * The cast grid used to send every name to a Google search. That is a link out
 * of the site for the single most common follow-up somebody has on a title
 * page, and now some of those names have a page here instead. Only *some*:
 * /person/[id] is prerendered for a bounded set (see services/people.ts), and a
 * link to an id outside it would be a 404 — so the page asks, per title, which
 * of ITS names are in the set and links only those.
 *
 * The caller passes every cast and crew id worth linking, and gets back just
 * the ones with pages. Crew links up to three jobs: Director, Writer,
 * Producer. Casting beyond position 10 is still worth a link, so the caller
 * decides the slice — this helper just filters.
 *
 * Module-scope, not React `cache()`: this is immutable build-time data read
 * once per page, and React's cache is per-request — which would have re-read it
 * two thousand times. Never runs in the production Worker (React does not run
 * there at all).
 */
let pageIds: Promise<Set<number>> | undefined

const loadPageIds = async (): Promise<Set<number>> => {
  try {
    return new Set(getPeopleWithPages().map((person) => person.id))
  } catch {
    // No person pages this build is a missing link, not a broken page.
    return new Set()
  }
}

export const personPageIds = (): Promise<Set<number>> =>
  (pageIds ??= loadPageIds())

export const linkablePersonIds = async (ids: number[]): Promise<number[]> => {
  const set = await personPageIds()
  return ids.filter((id) => set.has(id))
}
