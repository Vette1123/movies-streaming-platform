import React from 'react'
import { useRouter } from 'next/navigation'
import { Loader, Play, Tv } from 'lucide-react'

import { EpisodeDetails } from '@/types/episode'
import {
  trackWatchHistoryAdded,
  trackWatchHistoryUpdated,
} from '@/lib/analytics'
import { syncWatchStats } from '@/lib/person'
import { cn, dateFormatter } from '@/lib/utils'
import { useLocalStorage, type WatchedItem } from '@/hooks/use-local-storage'
import { useScrollToTop } from '@/hooks/use-scroll-to-top'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

// Weekly release cadence + a week's grace, mirroring the "New Episode" window
// streaming apps use. Keeps the badge cross-season: whichever season holds a
// recently-aired episode lights up automatically.
const NEW_EPISODE_DAYS = 14

interface EpisodesProps {
  episodes: EpisodeDetails[] | undefined
  selectedSeason: string
  isEpisodesLoading: boolean
  backdrop_path: string
  poster_path: string
  series_name: string
}

// Animated three-bar equalizer marking the episode that's currently playing.
function NowPlayingBars() {
  return (
    <span className="flex h-3.5 items-end gap-[3px]" aria-hidden>
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="animate-equalize bg-primary w-[3px] origin-bottom rounded-full"
          style={{ height: '100%', animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
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
    let nextItems: WatchedItem[]
    if (existingItemIndex === -1) {
      nextItems = [
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
      ]
      trackWatchHistoryAdded({
        media_id: episode?.show_id,
        media_type: 'tv',
        title: series_name,
      })
    } else {
      const existingItem = watchedItems[existingItemIndex]

      nextItems = [...watchedItems]
      nextItems[existingItemIndex] = {
        ...existingItem,
        season: Number(selectedSeason),
        episode: episode?.episode_number,
        modified_at: new Date().toISOString(),
      }
      trackWatchHistoryUpdated({
        media_id: episode?.show_id,
        media_type: 'tv',
        season: Number(selectedSeason),
        episode: episode?.episode_number,
      })
    }
    setWatchedItems(nextItems)
    // episodes.tsx writes localStorage directly (not via useWatchedMedia), so
    // sync the PostHog person profile's watch stats here too.
    syncWatchStats(nextItems)

    router.push(
      `?season=${selectedSeason}&episode=${episode?.episode_number}`,
      { scroll: false }
    )
    scrollToTop()
  }

  return (
    <section className="space-y-1 p-2 sm:p-2.5">
      {!episodes?.length && isEpisodesLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader className="size-6 shrink-0 animate-spin opacity-80" />
        </div>
      )}
      {!episodes?.length && !isEpisodesLoading && (
        <div
          role="status"
          className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm"
        >
          <Tv className="size-6 opacity-60" aria-hidden />
          No episodes found for this season yet.
        </div>
      )}
      {episodes?.length
        ? episodes.map((episode) => {
            const isActive =
              episodeQueryINT === episode?.episode_number &&
              seasonQueryINT === Number(selectedSeason)

            return (
              <button
                key={episode.id}
                type="button"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => handleWatchEpisode(episode)}
                className={cn(
                  'group/ep flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors',
                  isActive
                    ? 'bg-primary/10 ring-primary/25 ring-1'
                    : 'hover:bg-accent'
                )}
              >
                <span
                  className={cn(
                    'mt-px grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold tabular-nums transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground group-hover/ep:bg-background'
                  )}
                >
                  {episode.episode_number}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'text-sm leading-snug font-medium',
                        isActive ? 'text-primary' : 'text-foreground/90'
                      )}
                    >
                      {episode.name}
                    </span>
                    <NewBadgeWhenRecent
                      date={episode?.air_date}
                      withinDays={NEW_EPISODE_DAYS}
                      className="relative top-0 left-0 shrink-0"
                    />
                  </span>
                  {(episode?.air_date || episode?.runtime) && (
                    <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                      {episode?.air_date && (
                        <span>{dateFormatter(episode.air_date, true)}</span>
                      )}
                      {episode?.air_date && episode?.runtime ? (
                        <span aria-hidden>•</span>
                      ) : null}
                      {episode?.runtime ? (
                        <span>{episode.runtime} min</span>
                      ) : null}
                    </span>
                  )}
                </span>

                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                  {isActive ? (
                    <NowPlayingBars />
                  ) : (
                    <Play className="text-muted-foreground size-4 fill-current opacity-0 transition-opacity group-hover/ep:opacity-100" />
                  )}
                </span>
              </button>
            )
          })
        : null}
    </section>
  )
}
