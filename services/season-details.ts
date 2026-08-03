import { Param } from '@/types/movie-result'
import { SeasonDetails } from '@/types/season-details'
import { fetchClient } from '@/lib/fetch-client'

// Episodes for one season, moved out of actions/season-details.ts (a Server
// Action, which a static export cannot contain) so cloudflare/worker.js can
// serve it as /api/season-details.
export const getSeasonEpisodes = async (
  seasonId: number,
  seasonNumber: string,
  params?: Param
) => {
  const url = `tv/${seasonId}/season/${seasonNumber}?language=en-US`
  try {
    return await fetchClient.get<SeasonDetails>(url, params, true)
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
