import React from 'react'
import { useRouter } from 'next/navigation'
import { Loader } from 'lucide-react'

import { EpisodeDetails } from '@/types/episode'
import { cn } from '@/lib/utils'
import { useScrollToTop } from '@/hooks/use-scroll-to-top'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { Separator } from '@/components/ui/separator'

interface EpisodesProps {
  episodes: EpisodeDetails[] | undefined
  selectedSeason: string
  isEpisodesLoading: boolean
}

export const Episodes = ({
  episodes,
  selectedSeason,
  isEpisodesLoading,
}: EpisodesProps) => {
  const router = useRouter()
  const { episodeQueryINT, seasonQueryINT } = useSearchQueryParams()
  const { scrollToTop } = useScrollToTop()

  return (
    <section className="p-4">
      {!episodes?.length && isEpisodesLoading && (
        <div className="flex items-center justify-center">
          <Loader className="mr-2 h-6 w-6 shrink-0 animate-spin opacity-80" />
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
                  router.push(
                    `?season=${selectedSeason}&episode=${episode?.episode_number}`,
                    { scroll: false }
                  )
                  scrollToTop()
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
