import React from 'react'

import { useSearchQueryParams } from '@/hooks/use-search-params'
import { useSeasonEpisodes } from '@/hooks/use-season-episodes'

export const useEpisodeHandler = (seriesID: number, resumeSeason?: number) => {
  const { seasonQuerySTR } = useSearchQueryParams()
  const [selectedSeason, setSelectedSeason] = React.useState<string>(
    seasonQuerySTR || '1'
  )
  // The auto-jump to the continue-watching season is a ONE-SHOT convenience,
  // not a mode: a ?season deep-link or any manual pick claims the selection for
  // good, so a later localStorage write (starting an episode) can never yank
  // the list back to another season while the user is browsing it.
  const seasonClaimedRef = React.useRef(false)

  const selectSeason = React.useCallback((season: string) => {
    seasonClaimedRef.current = true
    setSelectedSeason(season)
  }, [])

  React.useEffect(() => {
    if (seasonClaimedRef.current) return
    if (seasonQuerySTR) {
      seasonClaimedRef.current = true
      return
    }
    if (!resumeSeason) return
    seasonClaimedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSeason(String(resumeSeason))
  }, [resumeSeason, seasonQuerySTR])

  const { episodes, isEpisodesLoading } = useSeasonEpisodes(
    seriesID,
    selectedSeason
  )

  return {
    selectedSeason,
    selectSeason,
    episodes,
    isEpisodesLoading,
  }
}
