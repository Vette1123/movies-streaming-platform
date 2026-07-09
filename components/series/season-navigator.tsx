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
    <aside className="w-full lg:w-72 lg:shrink-0">
      <SeasonsSelector series={series} setSelectedSeason={setSelectedSeason} />
      <ScrollArea className="bg-card/40 h-[26rem] w-full rounded-xl border shadow-sm lg:h-[34rem]">
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
