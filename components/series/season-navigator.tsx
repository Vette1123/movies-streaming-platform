'use client'

import React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { useEpisodeHandler } from '@/hooks/use-episode-handler'
import { useSeriesProgress } from '@/hooks/use-series-progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Episodes } from '@/components/series/episodes'
import { SeasonsSelector } from '@/components/series/selector'

// Reserves the navigator's exact box while the subtree hydrates. The season
// selector reads ?season during render, which under a static prerender bails
// its Suspense boundary to CSR — this is what that boundary renders into the
// HTML, so it has to match the real aside's dimensions or the page shifts.
export const SeasonNavigatorFallback = () => (
  <aside className="w-full lg:w-72 lg:shrink-0" aria-hidden>
    <div className="mb-3 h-11 w-full rounded-md bg-muted/50" />
    <div className="h-104 w-full rounded-xl border bg-card/40 shadow-sm lg:h-136" />
  </aside>
)

export const SeasonNavigator = ({ series }: { series: SeriesDetails }) => {
  const { resume } = useSeriesProgress(series)
  // Opens on the season the user is actually part-way through instead of
  // always season 1 (a ?season deep-link or a manual pick still wins).
  const { selectSeason, episodes, selectedSeason, isEpisodesLoading } =
    useEpisodeHandler(series?.id, resume?.season)

  return (
    // Named, and with a heading. This panel is the whole point of a TV page
    // and it had neither: the outline ran h1 -> "Cast" with the episode list
    // nowhere in it, and the landmark announced as an unnamed complementary.
    // The heading is screen-reader-only because the season <Select> below is
    // the visible label, and it says WHICH season rather than what this is.
    <aside className="w-full lg:w-72 lg:shrink-0" aria-label="Episodes">
      <h2 className="sr-only">Episodes</h2>
      <SeasonsSelector
        series={series}
        selectedSeason={selectedSeason}
        onSeasonChange={selectSeason}
      />
      <ScrollArea className="h-104 w-full rounded-xl border bg-card/40 shadow-sm lg:h-136">
        <Episodes
          episodes={episodes}
          selectedSeason={selectedSeason}
          isEpisodesLoading={isEpisodesLoading}
          backdrop_path={series?.backdrop_path}
          poster_path={series?.poster_path}
          series_name={series?.name}
          resume={resume}
        />
      </ScrollArea>
    </aside>
  )
}
