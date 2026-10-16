'use client'

import React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { seasonMeta, seasonTabsOf } from '@/lib/season-tabs'
import { useEpisodeHandler } from '@/hooks/use-episode-handler'
import { useSeriesProgress } from '@/hooks/use-series-progress'
import { Episodes, EpisodeSkeletons } from '@/components/series/episodes'
import {
  EPISODES_PANEL_ID,
  SeasonsSelector,
  seasonTabId,
} from '@/components/series/selector'

// What the Suspense boundary renders into the HTML while the subtree hydrates:
// the season selector reads ?season during render, which under a static
// prerender bails this boundary to CSR. Same shapes as the real thing — a row
// of season pills over the episode skeletons — so it reads as loading, not as
// a different layout that then swaps out.
export const SeasonNavigatorFallback = () => (
  <div aria-hidden>
    <div className="flex gap-2 overflow-hidden">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className="h-11 w-28 shrink-0 animate-pulse rounded-full bg-muted/50"
        />
      ))}
    </div>
    <div className="mt-6 sm:mt-8">
      <EpisodeSkeletons />
    </div>
  </div>
)

/**
 * Season tabs over the season's episodes, full width, directly under the hero.
 *
 * It used to be a 288px column at the far end of the synopsis row: below the
 * fold on a laptop, and on a phone ~5000px down, after the synopsis, the facts,
 * eight cast portraits and the poster. On the page whose whole point is picking
 * an episode, the picker was the last thing on it. The section and its heading
 * live in SeriesDetailsContent (server-rendered, so the heading is in the HTML
 * even while this hydrates); this is the interactive part.
 */
export const SeasonNavigator = ({ series }: { series: SeriesDetails }) => {
  const { resume } = useSeriesProgress(series)
  // Opens on the season the user is actually part-way through instead of
  // always season 1 (a ?season deep-link or a manual pick still wins).
  const {
    selectSeason,
    episodes,
    selectedSeason,
    isEpisodesLoading,
    isSeasonStale,
    isEpisodesError,
    retryEpisodes,
  } = useEpisodeHandler(series?.id, resume?.season)
  const meta = React.useMemo(
    () =>
      seasonMeta(
        seasonTabsOf(series?.seasons).find(
          (tab) => String(tab.season) === selectedSeason
        )
      ),
    [series?.seasons, selectedSeason]
  )

  return (
    <div>
      <SeasonsSelector
        series={series}
        selectedSeason={selectedSeason}
        onSeasonChange={selectSeason}
      />
      {meta ? (
        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
          {meta}
        </p>
      ) : null}
      <div
        role="tabpanel"
        id={EPISODES_PANEL_ID}
        aria-labelledby={seasonTabId(selectedSeason)}
        className="mt-5 sm:mt-6"
      >
        <Episodes
          episodes={episodes}
          selectedSeason={selectedSeason}
          isEpisodesLoading={isEpisodesLoading}
          isSeasonStale={isSeasonStale}
          isEpisodesError={isEpisodesError}
          onRetry={retryEpisodes}
          backdrop_path={series?.backdrop_path}
          poster_path={series?.poster_path}
          series_name={series?.name}
          resume={resume}
        />
      </div>
    </div>
  )
}
