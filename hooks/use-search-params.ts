import React from 'react'
import { useSearchParams } from 'next/navigation'

export interface SeasonEpisodeParams {
  seasonQueryINT: number
  episodeQueryINT: number
  seasonQuerySTR: string | null
  episodeQuerySTR: string | null
}

const toSeasonEpisode = (params: URLSearchParams): SeasonEpisodeParams => {
  const seasonQuerySTR = params.get('season')
  const episodeQuerySTR = params.get('episode')
  return {
    seasonQuerySTR,
    episodeQuerySTR,
    seasonQueryINT: Number(seasonQuerySTR),
    episodeQueryINT: Number(episodeQuerySTR),
  }
}

const EMPTY_SEASON_EPISODE: SeasonEpisodeParams = {
  seasonQuerySTR: null,
  episodeQuerySTR: null,
  seasonQueryINT: 0,
  episodeQueryINT: 0,
}

// Event-time reader for ?season / ?episode. Deliberately NOT a hook: calling
// `useSearchParams()` during a static prerender makes Next bail the nearest
// Suspense boundary to client-side rendering (BAILOUT_TO_CLIENT_SIDE_RENDERING),
// and on these routes that boundary is the route's own loading.tsx — so the
// WHOLE page shipped as a skeleton with no <h1> and no crawlable text. Callbacks
// only ever run in the browser, so reading window.location there is both safe
// and always current. Use this from click/effect handlers; use the hook below
// only where a value must be read during render (and wrap that in <Suspense>).
export const readSeasonEpisodeParams = (): SeasonEpisodeParams => {
  if (typeof window === 'undefined') return EMPTY_SEASON_EPISODE
  return toSeasonEpisode(new URLSearchParams(window.location.search))
}

// Render-time reader. Any component calling this MUST sit inside its own
// <Suspense> boundary, or it takes the entire route client-side (see above).
export const useSearchQueryParams = (): SeasonEpisodeParams => {
  const searchParams = useSearchParams()
  return React.useMemo(
    () => toSeasonEpisode(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )
}
