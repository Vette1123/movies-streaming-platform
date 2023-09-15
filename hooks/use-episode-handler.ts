import React from 'react'
import { getSeasonEpisodesAction } from '@/actions/season-details'
import { useQuery } from '@tanstack/react-query'

import { useSearchQueryParams } from '@/hooks/use-search-params'

export const useEpisodeHandler = (seriesID: number) => {
  const { seasonQuerySTR } = useSearchQueryParams()
  const [selectedSeason, setSelectedSeason] = React.useState<string>(
    seasonQuerySTR || '1'
  )

  const getSeasonEpisodes = React.useCallback(
    async (seriesId: number, seasonNumber: string) => {
      const seasonDetails = await getSeasonEpisodesAction(
        seriesId,
        seasonNumber
      )
      return seasonDetails?.episodes
    },
    []
  )
  const { data: episodes, isLoading: isEpisodesLoading } = useQuery({
    queryKey: [selectedSeason, seriesID],
    queryFn: () => getSeasonEpisodes(seriesID, selectedSeason),
    enabled: Boolean(seriesID),
  })

  return {
    selectedSeason,
    setSelectedSeason,
    getSeasonEpisodes,
    episodes,
    isEpisodesLoading,
  }
}
