import React from 'react'
import { useRouter } from 'next/navigation'
import { Loader } from 'lucide-react'

import { EpisodeDetails } from '@/types/episode'
import { cn } from '@/lib/utils'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { Separator } from '@/components/ui/separator'

interface EpisodesProps {
  episodes: EpisodeDetails[] | undefined
  selectedSeason: string
}

export const Episodes = ({ episodes, selectedSeason }: EpisodesProps) => {
  const router = useRouter()
  const { episodeQueryINT, seasonQueryINT } = useSearchQueryParams()

  return (
    <section className="p-4">
      {!episodes?.length && (
        <div className="flex items-center justify-center">
          <Loader className="mr-2 h-6 w-6 shrink-0 animate-spin opacity-80" />
        </div>
      )}
      {episodes?.length &&
        episodes.map((episode, idx) => (
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
              onClick={() =>
                router.push(
                  `?season=${selectedSeason}&episode=${episode?.episode_number}`,
                  { scroll: false }
                )
              }
            >
              {episode.episode_number}. {episode.name}
            </p>
            {idx !== episodes?.length - 1 && <Separator className="my-3" />}
          </React.Fragment>
        ))}
    </section>
  )
}
