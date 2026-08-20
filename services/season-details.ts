import { Param } from '@/types/movie-result'
import { SeasonDetails } from '@/types/season-details'
import { fetchClient } from '@/lib/fetch-client'

// Episodes for one season, moved out of actions/season-details.ts (a Server
// Action, which a static export cannot contain) so cloudflare/worker.js can
// serve it as /api/season-details.
/**
 * Drop the two per-episode blocks nothing renders.
 *
 * TMDB answers a season with `crew` and `guest_stars` on every episode — 92 KB
 * of the 97 KB it returned for Game of Thrones season 1. Neither is read
 * anywhere on the site (`guest_stars` appears only in the type), and the Worker
 * was stringifying, cloning into `caches.default` and shipping all of it: this
 * was the single most expensive route measured in production, at 19ms of CPU
 * against a 10ms budget on its worst request.
 */
const trimEpisodes = (season: SeasonDetails): SeasonDetails => ({
  ...season,
  episodes: (season.episodes ?? []).map(
    ({ crew, guest_stars, ...episode }) => episode
  ),
})

export const getSeasonEpisodes = async (
  seasonId: number,
  seasonNumber: string,
  params?: Param
) => {
  const url = `tv/${seasonId}/season/${seasonNumber}?language=en-US`
  try {
    return trimEpisodes(await fetchClient.get<SeasonDetails>(url, params, true))
  } catch (error) {
    // A season that doesn't exist (404) is a normal outcome, not a failure:
    // return an empty list so the UI shows "no episodes" instead of erroring or
    // retrying. Transient failures (timeout / 429 / 5xx / network) are rethrown
    // so React Query retries and the list self-heals rather than going blank.
    const message = error instanceof Error ? error.message : ''
    if (message.includes('404')) {
      // Only `episodes` is consumed downstream; the rest of SeasonDetails is
      // irrelevant for a season that doesn't exist.
      return { episodes: [] } as unknown as SeasonDetails
    }
    throw error
  }
}
