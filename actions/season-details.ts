'use server'

import { Param } from '@/types/movie-result'
import { SeasonDetails } from '@/types/season-details'
import { fetchClient } from '@/lib/fetch-client'

export const getSeasonEpisodesAction = async (
  seasonId: number,
  seasonNumber: string,
  params?: Param
) => {
  const url = `tv/${seasonId}/season/${seasonNumber}?language=en-US`
  return fetchClient.get<SeasonDetails>(url, params, true)
}
