import { cache } from 'react'

import { Movie, Param } from '@/types/movie-result'
import { fetchClient } from '@/lib/fetch-client'
import { capListOverviews } from '@/lib/media'

/**
 * Cast and crew, as pages of their own.
 *
 * "<actor> movies" is the biggest class of search this site had no page for:
 * every title page names the cast, and every one of those names was a dead end.
 * A person page turns each of them into a hub that links back into the
 * catalogue, which is worth as much to the titles as it is to the person.
 *
 * The set is TMDB's own popularity ranking rather than the cast lists of what
 * this site prerenders. Those cast lists are the more "correct" set and are
 * roughly six thousand people — five times what the 20,000-file asset cap has
 * room for (a static export writes ~10 files per route). Popularity is the
 * cheap approximation of the same head of the distribution: 10 requests, and it
 * is the same ordering the search demand follows.
 */

/** 20 people per TMDB page. 10 pages = 200, measured against the file cap. */
const PERSON_LIST_DEPTH = 10

/** As many credits as a page can show without becoming a database dump. */
const CREDIT_LIMIT = 24

export interface PersonSummary {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string
}

export interface PersonDetails extends PersonSummary {
  biography?: string
  birthday?: string | null
  deathday?: string | null
  place_of_birth?: string | null
  homepage?: string | null
  also_known_as?: string[]
}

interface PersonListResponse {
  results?: PersonSummary[]
}

interface CombinedCredits {
  cast?: (Movie & { character?: string })[]
  crew?: (Movie & { job?: string })[]
}

interface PersonWithCredits extends PersonDetails {
  combined_credits?: CombinedCredits
}

/**
 * The people who get a page.
 *
 * revalidate:false — build-only, like every other list behind a static page.
 * Fails soft to [] so a TMDB hiccup drops the person pages from one deploy
 * rather than breaking it.
 */
export const getPopularPeople = cache(async (): Promise<PersonSummary[]> => {
  const requests = Array.from({ length: PERSON_LIST_DEPTH }, (_, index) =>
    fetchClient.get<PersonListResponse>(
      `person/popular?language=en-US&page=${index + 1}`,
      {},
      true,
      false
    )
  )
  const responses = await Promise.allSettled(requests)
  const byId = new Map<number, PersonSummary>()
  for (const response of responses) {
    if (response.status !== 'fulfilled') continue
    for (const person of response.value?.results ?? []) {
      // No profile photo is a page that is mostly empty space, and TMDB's
      // popular list carries a few. Skip rather than ship a thin page.
      if (!person?.id || !person.name || !person.profile_path) continue
      if (!byId.has(person.id)) byId.set(person.id, person)
    }
  }
  return [...byId.values()]
})

/**
 * Rank a person's credits by how likely somebody is looking for THAT one.
 *
 * TMDB returns combined credits in no useful order — a walk-on in a huge film
 * and a lead in an unknown one sit side by side. Vote count is the honest proxy
 * for "the thing this person is known for", and billing order breaks the ties.
 */
const byProminence = (
  a: Movie & { order?: number },
  b: Movie & { order?: number }
) => {
  const votes = (b.vote_count ?? 0) - (a.vote_count ?? 0)
  if (votes !== 0) return votes
  return (a.order ?? 999) - (b.order ?? 999)
}

export const getPersonById = cache(
  async (id: string, params: Param = {}): Promise<PersonWithCredits> =>
    // One request for the person and everything they were in — the same
    // append_to_response discipline the detail pages use.
    fetchClient.get<PersonWithCredits>(
      `person/${id}?language=en-US&append_to_response=combined_credits`,
      params,
      true,
      false
    )
)

export interface PersonPageData {
  person: PersonDetails
  credits: Movie[]
}

export const populatePersonPage = async (
  id: string
): Promise<PersonPageData> => {
  const data = await getPersonById(id)
  if (!data?.id) throw new Error('Person not found')

  const { combined_credits: combined, ...person } = data
  const seen = new Set<number>()
  const credits: Movie[] = []
  for (const credit of [...(combined?.cast ?? [])].sort(byProminence)) {
    // A person can appear twice in one title (two roles, or cast AND crew).
    if (!credit?.id || seen.has(credit.id)) continue
    // Anything with no votes at all is a stub entry; a grid of those reads as
    // a broken page rather than a filmography.
    if (!credit.vote_count) continue
    seen.add(credit.id)
    credits.push(credit)
    if (credits.length >= CREDIT_LIMIT) break
  }

  return { person, credits: capListOverviews(credits) }
}
