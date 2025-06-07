'use client'

import React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { useEpisodeHandler } from '@/hooks/use-episode-handler'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Episodes } from '@/components/series/episodes'
import { SeasonsSelector } from '@/components/series/selector'

export const SeasonNavigator = ({ series }: { series: SeriesDetails }) => {
  const { setSelectedSeason, episodes, selectedSeason, isEpisodesLoading } =
    useEpisodeHandler(series?.id)

  return (
    <aside className="max-w-(--breakpoint-2xl)">
      <SeasonsSelector series={series} setSelectedSeason={setSelectedSeason} />
      <ScrollArea className="h-96 w-full rounded-md border lg:w-60">
        <Episodes
          episodes={episodes}
          selectedSeason={selectedSeason}
          isEpisodesLoading={isEpisodesLoading}
          backdrop_path={series?.backdrop_path}
          poster_path={series?.poster_path}
          series_name={series?.name}
        />
      </ScrollArea>
    </aside>
  )
}
