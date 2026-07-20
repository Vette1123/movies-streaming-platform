import React from 'react'
import { getSeasonEpisodesAction } from '@/actions/season-details'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { trackApiError } from '@/lib/analytics'
import { useSearchQueryParams } from '@/hooks/use-search-params'

export const useEpisodeHandler = (seriesID: number) => {
  const { seasonQuerySTR } = useSearchQueryParams()
  const [selectedSeason, setSelectedSeason] = React.useState<string>(
    seasonQuerySTR || '1'
  )

  const getSeasonEpisodes = React.useCallback(
    async (seriesId: number, seasonNumber: string) => {
      try {
        const seasonDetails = await getSeasonEpisodesAction(
          seriesId,
          seasonNumber
        )
        return seasonDetails?.episodes ?? []
      } catch (error) {
        // Record the failure before rethrowing so React Query can retry — a
        // flaky episode list is now visible in analytics instead of silent.
        trackApiError({
          source: 'season_episodes',
          media_id: seriesId,
          media_type: 'tv',
          season: Number(seasonNumber),
          message: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    []
  )
  const { data: episodes, isLoading: isEpisodesLoading } = useQuery({
    queryKey: ['season-episodes', seriesID, selectedSeason],
    queryFn: () => getSeasonEpisodes(seriesID, selectedSeason),
    enabled: Boolean(seriesID),
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
    selectedSeason,
    setSelectedSeason,
    getSeasonEpisodes,
    episodes,
    isEpisodesLoading,
  }
}
