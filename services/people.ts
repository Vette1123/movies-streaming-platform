import { cache } from 'react'
import PEOPLE from '@/data/people.json'

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
 * The set is a COMMITTED file, data/people.json, not a live TMDB list.
 *
 * It used to be TMDB's own popularity ranking, read at build time. That list
 * moves daily, and `dynamicParams = false` means a person who drops out of it
 * becomes a hard 404 on the next deploy — for a URL the sitemap had already
 * advertised and Google had already indexed. Search Console reported exactly
 * that. A file changes when somebody runs `pnpm people:refresh`, which unions
 * rather than replaces, so a page that has been advertised stays.
 *
 * The cast lists of what this site prerenders would be the more "correct" set
 * and are roughly six thousand people — five times what the 20,000-file asset
 * cap has room for (a static export writes ~10 files per route). Popularity is
 * the cheap approximation of the same head of the distribution, and it is the
 * same ordering the search demand follows.
 */

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

interface CombinedCredits {
  cast?: (Movie & { character?: string })[]
  crew?: (Movie & { job?: string })[]
}

interface PersonWithCredits extends PersonDetails {
  combined_credits?: CombinedCredits
}

/**
 * The people who get a page: data/people.json, verbatim.
 *
 * No TMDB request and no failure mode — the file is in the bundle. It is also
 * why the sitemap can list person URLs without a network call, and why two
 * consecutive deploys advertise the same ones.
 */
export const getPeopleWithPages = (): PersonSummary[] => PEOPLE

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
