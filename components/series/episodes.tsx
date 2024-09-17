import React from 'react'
import { useRouter } from 'next/navigation'
import { Loader } from 'lucide-react'

import { EpisodeDetails } from '@/types/episode'
import { cn } from '@/lib/utils'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useScrollToTop } from '@/hooks/use-scroll-to-top'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { Separator } from '@/components/ui/separator'

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
    <section className="p-4">
      {!episodes?.length && isEpisodesLoading && (
        <div className="flex items-center justify-center">
          <Loader className="mr-2 size-6 shrink-0 animate-spin opacity-80" />
        </div>
      )}
      {!episodes?.length && !isEpisodesLoading && (
        <p className="text-center text-sm">No episodes found</p>
      )}
      {episodes?.length
        ? episodes.map((episode, idx) => (
            <React.Fragment key={episode.id}>
              <p
                className={cn(
                  'cursor-pointer rounded-md p-2 text-sm hover:bg-accent',
                  {
                    'bg-accent':
                      episodeQueryINT === episode?.episode_number &&
                      seasonQueryINT === Number(selectedSeason),
                  }
                )}
                role="button"
                onClick={() => {
                  handleWatchEpisode(episode)
                }}
              >
                {episode.episode_number}. {episode.name}
              </p>
              {idx !== episodes?.length - 1 && <Separator className="my-3" />}
            </React.Fragment>
          ))
        : null}
    </section>
  )
}
