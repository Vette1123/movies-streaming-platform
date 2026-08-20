import React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Eye, Play, Tv } from 'lucide-react'

import { EpisodeDetails } from '@/types/episode'
import {
  trackWatchHistoryAdded,
  trackWatchHistoryUpdated,
} from '@/lib/analytics'
import { syncWatchStats } from '@/lib/person'
import { cn, dateFormatter } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { useCompletedMedia } from '@/hooks/use-completed-media'
import { useLocalStorage, type WatchedItem } from '@/hooks/use-local-storage'
import { useMounted } from '@/hooks/use-mounted'
import { useScrollToTop } from '@/hooks/use-scroll-to-top'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { type ResumePoint } from '@/hooks/use-series-progress'
import { SkeletonRows } from '@/components/ui/skeleton'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'
import { useSeriesPlayback } from '@/components/series/playback-context'

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
  resume?: ResumePoint | null
}

// The episode this season's list should center on: whatever is playing, else
// the one the URL points at, else the continue-watching episode. Null when none
// of them belongs to this season.
const resolveFocusEpisode = (
  playingEpisode: number | null,
  selectedEpisode: number | null,
  resumeEpisode: number | null
) => playingEpisode ?? selectedEpisode ?? resumeEpisode

const inThisSeason = (
  selectedSeason: string,
  season?: number,
  episode?: number
) => (Number(selectedSeason) === season && episode ? episode : null)

const getRowStateClass = (isActive: boolean, isUpNext: boolean) => {
  if (isActive) return 'bg-primary/10 ring-primary/25 ring-1'
  // Softer than the playing row: an offer, not a state.
  if (isUpNext) return 'bg-primary/5 ring-primary/20 hover:bg-accent ring-1'
  return 'hover:bg-accent'
}

const getEpisodeBadgeClass = (
  isActive: boolean,
  isUpNext: boolean,
  completed: boolean
) => {
  if (isActive) return 'bg-primary-fill text-primary-foreground'
  if (completed)
    return 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30'
  if (isUpNext) return 'bg-primary/15 text-primary'
  return 'bg-muted text-muted-foreground group-hover/ep:bg-background'
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

/**
 * An episode title is a spoiler.
 *
 * "Ozymandias", "The Rains of Castamere", "Who Shot Mr. Burns?" — a season
 * list is a list of things that are going to happen, sitting directly under
 * the player, and there is no way to use the episode picker without reading
 * it. That is the whole problem this solves, and it is why the mask is on the
 * NAME rather than on a thumbnail: the name is the part that is always visible
 * and always ahead of you.
 *
 * Only episodes you have not ticked off are masked, and only when the setting
 * is on. Anything already watched shows its real title, because it cannot
 * spoil what you have seen — and the episode currently playing keeps its name
 * too, since you have just chosen to watch it.
 */
const maskedName = (episodeNumber: number): string => `Episode ${episodeNumber}`

export const Episodes = ({
  episodes,
  selectedSeason,
  isEpisodesLoading,
  backdrop_path,
  poster_path,
  series_name,
  resume,
}: EpisodesProps) => {
  const router = useRouter()
  const [watchedItems, setWatchedItems] = useLocalStorage('watchedItems', [])
  const { episodeQueryINT, seasonQueryINT } = useSearchQueryParams()
  const { playing, requestPlay } = useSeriesPlayback()
  const { scrollToTop } = useScrollToTop()
  const { isEpisodeCompleted, toggleEpisodeCompleted, markEpisodesCompleted } =
    useCompletedMedia()
  const { prefs } = useAccount()
  const spoilerFree = prefs.spoilerFree === true
  // Per-episode, and deliberately not persisted: revealing one title is a
  // decision about one episode in one sitting, not a setting. It resets on
  // navigation, which is the behaviour somebody who turned this on wants.
  const [revealed, setRevealed] = React.useState<Set<number>>(new Set())
  const reveal = React.useCallback((episodeNumber: number) => {
    setRevealed((current) => new Set(current).add(episodeNumber))
  }, [])
  // localStorage is client-only — gate the completed ticks on mount to stay
  // hydration-safe (same rule as NewBadgeWhenRecent).
  const isMounted = useMounted()

  const upNextEpisode = inThisSeason(
    selectedSeason,
    resume?.season,
    resume?.episode
  )
  // "Playing" is what the embed is actually loaded with, NOT what ?season/
  // ?episode says: opening a continue-watching link points the page at an
  // episode without starting it, and a row that isn't playing must not claim to.
  const playingEpisode = inThisSeason(
    selectedSeason,
    playing?.season,
    playing?.episode
  )
  const selectedEpisode = inThisSeason(
    selectedSeason,
    seasonQueryINT,
    episodeQueryINT
  )
  const focusEpisode = resolveFocusEpisode(
    playingEpisode,
    selectedEpisode,
    upNextEpisode
  )
  const focusRowRef = React.useRef<HTMLButtonElement | null>(null)
  const centeredKeyRef = React.useRef<string | null>(null)

  // Bring the resumed / playing episode into view inside the list. Scrolls the
  // ScrollArea's own viewport by hand rather than calling scrollIntoView: that
  // would also scroll the PAGE, yanking the visitor away from the hero on load.
  // Runs once per (season, episode) so it can't fight manual scrolling.
  React.useEffect(() => {
    const row = focusRowRef.current
    if (!row || !focusEpisode) return
    const key = `${selectedSeason}:${focusEpisode}`
    if (centeredKeyRef.current === key) return
    const viewport = row.closest<HTMLElement>(
      '[data-radix-scroll-area-viewport]'
    )
    if (!viewport) return
    centeredKeyRef.current = key
    const rowBox = row.getBoundingClientRect()
    const viewportBox = viewport.getBoundingClientRect()
    viewport.scrollTop +=
      rowBox.top - viewportBox.top - (viewportBox.height - rowBox.height) / 2
  }, [episodes, focusEpisode, selectedSeason])

  const buildCompletionMeta = (episode: EpisodeDetails) => ({
    showId: episode.show_id,
    season: Number(selectedSeason),
    episode: episode.episode_number,
    seriesName: series_name,
    overview: episode.overview ?? '',
    backdrop_path: backdrop_path,
    poster_path: poster_path,
  })

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

    // Completion is unobservable (the player is a cross-origin embed), so infer
    // it linearly: starting an episode means the earlier ones in this season are
    // done. The episode being started is NOT marked — only what came before it.
    const earlier = (episodes ?? []).filter(
      (candidate) => candidate.episode_number < episode.episode_number
    )
    if (earlier.length) {
      markEpisodesCompleted(earlier.map(buildCompletionMeta))
    }

    // Clicking a row IS the play intent, so start the embed directly instead of
    // letting the URL trigger it — the params can already point at this episode
    // (arriving from continue-watching), and then nothing would change.
    requestPlay({
      season: Number(selectedSeason),
      episode: episode?.episode_number,
    })
    router.push(
      `?season=${selectedSeason}&episode=${episode?.episode_number}`,
      { scroll: false }
    )
    scrollToTop()
  }

  return (
    <section className="space-y-1 p-2 sm:p-2.5">
      {!episodes?.length && isEpisodesLoading && (
        <SkeletonRows
          rows={8}
          rowClassName="h-12 rounded-lg"
          className="space-y-1.5 py-1"
        />
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
            const isActive = playingEpisode === episode?.episode_number
            const isUpNext =
              isMounted && !isActive && upNextEpisode === episode.episode_number
            const isFocused = focusEpisode === episode.episode_number
            const completed =
              isMounted &&
              isEpisodeCompleted(
                episode.show_id,
                Number(selectedSeason),
                episode.episode_number
              )
            // isMounted, so the server and the first client pass render the
            // real name and the markup matches. A crawler therefore still sees
            // every episode title, which is what the SEO on these pages is
            // built from.
            const masked =
              isMounted &&
              spoilerFree &&
              !completed &&
              !isActive &&
              !revealed.has(episode.episode_number)

            return (
              <button
                key={episode.id}
                type="button"
                ref={isFocused ? focusRowRef : undefined}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => handleWatchEpisode(episode)}
                className={cn(
                  'group/ep flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors',
                  getRowStateClass(isActive, isUpNext)
                )}
              >
                <span
                  className={cn(
                    'mt-px grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold tabular-nums transition-colors',
                    getEpisodeBadgeClass(isActive, isUpNext, completed)
                  )}
                >
                  {episode.episode_number}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'text-sm leading-snug font-medium',
                        isActive ? 'text-primary' : 'text-foreground/90',
                        masked && 'text-muted-foreground italic'
                      )}
                    >
                      {masked
                        ? maskedName(episode.episode_number)
                        : episode.name}
                    </span>
                    {masked && (
                      // A span, not a button: this row is already a <button>
                      // that starts the episode, and nesting one inside it is
                      // invalid markup that browsers resolve by unnesting —
                      // which puts the reveal control OUTSIDE the row. The
                      // keyboard path is the row itself; this is a pointer
                      // affordance, so role and tabIndex are deliberately
                      // absent rather than faked.
                      <span
                        aria-hidden
                        title="Show this episode title"
                        onClick={(event) => {
                          event.stopPropagation()
                          reveal(episode.episode_number)
                        }}
                        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded px-1 text-[10px]"
                      >
                        <Eye className="size-3" />
                        Show
                      </span>
                    )}
                    <NewBadgeWhenRecent
                      date={episode?.air_date}
                      withinDays={NEW_EPISODE_DAYS}
                      className="relative top-0 left-0 shrink-0"
                    />
                    {isUpNext && (
                      <span className="bg-primary/15 text-primary shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                        {resume?.isNext ? 'Up next' : 'Continue'}
                      </span>
                    )}
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

                <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
                  {/* Manual watched toggle. Rendered as role="button", not a
                      real <button>: this whole row is already a <button>, and
                      nesting native buttons is invalid HTML. stopPropagation
                      keeps a toggle-tap from also triggering playback. */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-pressed={completed}
                    aria-label={
                      completed
                        ? 'Mark episode as not watched'
                        : 'Mark episode as watched'
                    }
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleEpisodeCompleted(buildCompletionMeta(episode))
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleEpisodeCompleted(buildCompletionMeta(episode))
                      }
                    }}
                    className={cn(
                      'grid size-5 cursor-pointer place-items-center rounded-full transition',
                      completed
                        ? 'text-emerald-500 hover:text-emerald-400'
                        : 'text-muted-foreground hover:text-foreground opacity-0 group-hover/ep:opacity-100 focus-visible:opacity-100'
                    )}
                  >
                    <Check
                      className="size-4"
                      strokeWidth={completed ? 3 : 2}
                      aria-hidden
                    />
                  </span>
                  <span className="flex size-5 items-center justify-center">
                    {isActive ? (
                      <NowPlayingBars />
                    ) : (
                      <Play className="text-muted-foreground size-4 fill-current opacity-0 transition-opacity group-hover/ep:opacity-100" />
                    )}
                  </span>
                </span>
              </button>
            )
          })
        : null}
    </section>
  )
}
