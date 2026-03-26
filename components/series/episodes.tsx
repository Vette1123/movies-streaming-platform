import React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Clock, Loader, PlayCircle, Star } from 'lucide-react'

import { EpisodeDetails } from '@/types/episode'
import { cn, getPosterImageURL } from '@/lib/utils'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useScrollToTop } from '@/hooks/use-scroll-to-top'
import { useSearchQueryParams } from '@/hooks/use-search-params'

interface EpisodesProps {
  episodes: EpisodeDetails[] | undefined
  selectedSeason: string
  isEpisodesLoading: boolean
  backdrop_path: string
  poster_path: string
  series_name: string
}

export const Episodes = ({
  episodes,
  selectedSeason,
  isEpisodesLoading,
  backdrop_path,
  poster_path,
  series_name,
}: EpisodesProps) => {
  const router = useRouter()
  const [watchedItems, setWatchedItems] = useLocalStorage('watchedItems', [])
  const { episodeQueryINT, seasonQueryINT } = useSearchQueryParams()
  const { scrollToTop } = useScrollToTop()

  const handleWatchEpisode = (episode: EpisodeDetails) => {
    const existingItemIndex = watchedItems.findIndex(
      (item) => item.id === episode?.show_id
    )
    if (existingItemIndex === -1) {
      setWatchedItems([
        ...watchedItems,
        {
          id: episode?.show_id,
          title: series_name,
          poster_path: poster_path,
          type: 'series',
          season: Number(selectedSeason),
          episode: episode?.episode_number,
          overview: episode?.overview,
          backdrop_path: backdrop_path,
          added_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        },
      ])
    } else {
      const existingItem = watchedItems[existingItemIndex]
      const updatedItems = [...watchedItems]
      updatedItems[existingItemIndex] = {
        ...existingItem,
        season: Number(selectedSeason),
        episode: episode?.episode_number,
        modified_at: new Date().toISOString(),
      }
      setWatchedItems(updatedItems)
    }

    router.push(
      `?season=${selectedSeason}&episode=${episode?.episode_number}`,
      { scroll: false }
    )
    scrollToTop()
  }

  return (
    <section className="divide-y divide-white/5">
      {!episodes?.length && isEpisodesLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="size-5 animate-spin opacity-60" />
        </div>
      )}
      {!episodes?.length && !isEpisodesLoading && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No episodes found
        </p>
      )}
      {episodes?.map((episode) => {
        const isActive =
          episodeQueryINT === episode?.episode_number &&
          seasonQueryINT === Number(selectedSeason)

        return (
          <button
            key={episode.id}
            className={cn(
              'group flex w-full gap-3 p-3 text-left transition-colors hover:bg-white/5',
              isActive
                ? 'border-l-2 border-white/60 bg-white/8 pl-[10px]'
                : 'border-l-2 border-transparent'
            )}
            onClick={() => handleWatchEpisode(episode)}
          >
            {/* Thumbnail */}
            <div className="relative h-[58px] w-[100px] shrink-0 overflow-hidden rounded-md bg-white/5">
              {episode.still_path ? (
                <>
                  <Image
                    src={getPosterImageURL(episode.still_path)}
                    alt={episode.name}
                    fill
                    className="object-cover"
                    sizes="100px"
                  />
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                    <PlayCircle className="size-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </>
              ) : (
                <div className="flex size-full items-center justify-center">
                  <PlayCircle className="size-5 text-white/20" />
                </div>
              )}
              {isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60">
                  <PlayCircle className="size-5 text-white" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/90">
                    Playing
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    'truncate text-sm font-medium leading-tight',
                    isActive ? 'text-white' : 'text-white/80'
                  )}
                >
                  <span className="mr-1 text-muted-foreground">
                    {episode.episode_number}.
                  </span>
                  {episode.name}
                </p>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {episode.vote_average > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="size-3 fill-yellow-400 text-yellow-400" />
                      {episode.vote_average.toFixed(1)}
                    </span>
                  )}
                  {episode.runtime > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {episode.runtime}m
                    </span>
                  )}
                </div>
              </div>
              {episode.overview && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {episode.overview}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </section>
  )
}
