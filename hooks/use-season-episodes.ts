import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getSeasonEpisodesApi } from '@/lib/api-client'

// ONE query definition for a season's episode list, shared by the season
// navigator and the hero's continue-watching caption. Identical query key +
// fetcher means TanStack de-duplicates them into a SINGLE /api/season-details call —
// naming the resume episode in the hero costs no extra TMDB subrequest, which
// matters against the free-plan 50-subrequests/invocation cap.
export const useSeasonEpisodes = (
  seriesId?: number,
  season?: string | number
) => {
  const {
    data: episodes,
    isLoading: isEpisodesLoading,
    isPlaceholderData,
    isError,
    refetch,
  } = useQuery({
    // String() so a numeric season (hero) and a string season (navigator) hash
    // to the same key instead of fetching the same list twice.
    queryKey: ['season-episodes', seriesId, String(season)],
    // No local try/catch reporting: the app-wide QueryCache.onError in
    // QueryProvider already reports every query that fails after its retries
    // are exhausted — ONCE — with the query_key (['season-episodes', id,
    // season]) carrying the identity. Reporting here too fired on every retry
    // attempt (4× per real failure), inflating the counts in PostHog.
    queryFn: async () => {
      const seasonDetails = await getSeasonEpisodesApi(
        Number(seriesId),
        String(season)
      )
      return seasonDetails?.episodes ?? []
    },
    enabled: Boolean(seriesId) && Boolean(season),
    // Keep the previous season's episodes on screen while the next season
    // loads, so switching seasons never flashes an empty list.
    placeholderData: keepPreviousData,
    // Retry transient failures (Worker/TMDB hiccups) before giving up, so a
    // single blip can never leave the list blank. 404s (nonexistent seasons)
    // are resolved to an empty list in the action and never reach here.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 5 * 60 * 1000,
  })

  return {
    episodes,
    isEpisodesLoading,
    /*
     * The list on screen belongs to the PREVIOUS season.
     *
     * `keepPreviousData` stops a season switch flashing an empty panel, and it
     * also means `isLoading` is false the whole time the new season is in
     * flight — so the navigator showed one season's episodes under another
     * season's name with nothing moving. That is what the rage clicks on
     * "Season 1" were: a picker that had already changed above a list that had
     * not. Callers dim the stale list instead of pretending it is current.
     */
    isSeasonStale: isPlaceholderData,
    /*
     * The request gave up after its retries. Without this the panel drew "No
     * episodes found for this season yet", which blames the show for a failure
     * that was ours — roughly a third of /api/season-details calls did not
     * answer over 24h.
     */
    isEpisodesError: isError,
    retryEpisodes: refetch,
  }
}
