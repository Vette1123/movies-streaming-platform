import React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Eye, Play, Tv } from 'lucide-react'

import { EpisodeDetails } from '@/types/episode'
import {
  trackEpisodeToggled,
  trackWatchHistoryAdded,
  trackWatchHistoryUpdated,
} from '@/lib/analytics'
import { syncWatchStats } from '@/lib/person'
import {
  playbackKey,
  readPositionMap,
  resumeShare,
  type PlaybackPosition,
} from '@/lib/playback-positions'
import { episodesShownAtFirst } from '@/lib/season-tabs'
import { cn, dateFormatter, getImageURL } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { useCompletedMedia } from '@/hooks/use-completed-media'
import { useLocalStorage, type WatchedItem } from '@/hooks/use-local-storage'
import { useMounted } from '@/hooks/use-mounted'
import { useScrollToTop } from '@/hooks/use-scroll-to-top'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { type ResumePoint } from '@/hooks/use-series-progress'
import { Button } from '@/components/ui/button'
import { BlurredImage } from '@/components/blurred-image'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'
import { useSeriesPlayback } from '@/components/series/playback-context'

// Weekly release cadence + a week's grace, mirroring the "New Episode" window
// streaming apps use. Keeps the badge cross-season: whichever season holds a
// recently-aired episode lights up automatically.
const NEW_EPISODE_DAYS = 14

// What each still paints at: a 144px thumb beside the text on a phone, then a
// 2/3/4-column grid inside the container (1536px cap, 2rem gutters).
const STILL_SIZES =
  '(min-width: 1280px) 360px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 144px'

interface EpisodesProps {
  episodes: EpisodeDetails[] | undefined
  selectedSeason: string
  isEpisodesLoading: boolean
  /** The visible list is the PREVIOUS season's — see use-season-episodes. */
  isSeasonStale?: boolean
  /** The request gave up. Not the same as a season with no episodes. */
  isEpisodesError?: boolean
  onRetry?: () => void
  backdrop_path: string
  poster_path: string
  series_name: string
  resume?: ResumePoint | null
}

const inThisSeason = (
  selectedSeason: string,
  season?: number,
  episode?: number
) => (Number(selectedSeason) === season && episode ? episode : null)

const initialCount = (
  episodes: EpisodeDetails[],
  focusEpisode: number | null
) =>
  episodesShownAtFirst(
    episodes.length,
    focusEpisode
      ? episodes.findIndex((episode) => episode.episode_number === focusEpisode)
      : -1
  )

// Animated three-bar equalizer marking the episode that's currently playing.
function NowPlayingBars() {
  return (
    <span className="flex h-3 items-end gap-[3px]" aria-hidden>
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="w-[3px] origin-bottom animate-equalize rounded-full bg-primary-foreground motion-reduce:animate-none"
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
 * it. With the setting on, an unwatched episode shows as its number, its still
 * is blurred past recognition and its synopsis is withheld — a still gives the
 * plot away as fast as a title does, now that the cards carry one.
 *
 * Anything already watched shows in full, because it cannot spoil what you
 * have seen — and the episode currently playing too, since you just chose it.
 */
const maskedName = (episodeNumber: number): string => `Episode ${episodeNumber}`

const stateChipClass = 'bg-primary-fill text-primary-foreground'

export const Episodes = ({
  episodes,
  selectedSeason,
  isEpisodesLoading,
  isSeasonStale,
  isEpisodesError,
  onRetry,
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
  // Which season's "Show all" was pressed. Keyed by season so switching
  // seasons folds the next one back to its opening count.
  const [expandedSeason, setExpandedSeason] = React.useState<string | null>(
    null
  )
  // localStorage is client-only — gate the completed ticks and the progress
  // bars on mount to stay hydration-safe (same rule as NewBadgeWhenRecent).
  const isMounted = useMounted()

  const upNextEpisode = inThisSeason(
    selectedSeason,
    resume?.season,
    resume?.episode
  )
  // "Playing" is what the embed is actually loaded with, NOT what ?season/
  // ?episode says: opening a continue-watching link points the page at an
  // episode without starting it, and a card that isn't playing must not claim to.
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
  const focusEpisode = playingEpisode ?? selectedEpisode ?? upNextEpisode

  // Where each episode was left, read once per season and again whenever
  // playback moves on (the player has just written the last one's position).
  const positions = React.useMemo<Record<string, PlaybackPosition>>(
    () => (isMounted ? readPositionMap() : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMounted, episodes, playing?.season, playing?.episode]
  )

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
    // What the tap ASKED for, first and synchronously. Clicking a card IS the
    // play intent, so start the embed directly instead of letting the URL
    // trigger it — the params can already point at this episode (arriving from
    // continue-watching), and then nothing would change.
    requestPlay({
      season: Number(selectedSeason),
      episode: episode?.episode_number,
    })
    router.push(
      `?season=${selectedSeason}&episode=${episode?.episode_number}`,
      { scroll: false }
    )
    scrollToTop()

    /*
     * Everything below is bookkeeping, and it used to run BEFORE the play —
     * two localStorage round trips over the whole watch history, a PostHog
     * person-property write, and a completion pass over every earlier episode
     * in the season, all inside the click. TV detail pages are where this
     * site's interaction latency lives: p75 INP is 384ms on the busiest one
     * and over a second on three others, against a 200ms "good" threshold, and
     * these cards are the only thing on the page doing work like this on a tap.
     *
     * None of it is visible, so none of it needs to be in the way of the
     * frame that shows playback starting. Deferring past the next paint hands
     * the browser the interaction back immediately; the work still happens,
     * a tick later, in the same order.
     */
    const commitProgress = () => {
      setWatchedItems(nextItems)
      // episodes.tsx writes localStorage directly (not via useWatchedMedia), so
      // sync the PostHog person profile's watch stats here too.
      syncWatchStats(nextItems)

      // Completion is unobservable on most servers (a cross-origin embed), so
      // infer it linearly: starting an episode means the earlier ones in this
      // season are done. The episode being started is NOT marked — only what
      // came before it.
      const earlier = (episodes ?? []).filter(
        (candidate) => candidate.episode_number < episode.episode_number
      )
      if (earlier.length) {
        markEpisodesCompleted(earlier.map(buildCompletionMeta))
      }
    }

    // requestIdleCallback where it exists, a macrotask where it does not
    // (Safari). Either way it lands after the browser has painted the tap.
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(commitProgress, { timeout: 1000 })
    } else {
      setTimeout(commitProgress, 0)
    }
  }

  const expanded = expandedSeason === selectedSeason
  const shownCount =
    episodes && !expanded
      ? initialCount(episodes, focusEpisode)
      : (episodes?.length ?? 0)
  const shown = episodes?.slice(0, shownCount) ?? []
  const hiddenCount = (episodes?.length ?? 0) - shown.length

  return (
    <div
      className={cn(
        'relative transition-opacity duration-200 motion-reduce:transition-none',
        // These cards belong to the season the visitor just left. Keeping them
        // on screen avoids an empty flash; dimming them and taking their clicks
        // away is what stops them reading as the season now named above.
        isSeasonStale && 'pointer-events-none opacity-40'
      )}
      aria-busy={isSeasonStale || undefined}
    >
      {!episodes?.length && isEpisodesLoading && <EpisodeSkeletons />}
      {/* A failed request is not an empty season. Saying "no episodes found"
          when the call never answered blames the show for our outage, and
          leaves the one useful action — try again — off the screen. */}
      {isEpisodesError && !episodes?.length && (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-xl bg-card/40 py-12 text-center text-sm text-muted-foreground ring-1 ring-white/5"
        >
          <Tv className="size-6 opacity-60" aria-hidden />
          <span>Couldn’t load this season.</span>
          {onRetry ? (
            <Button size="sm" variant="secondary" onClick={() => onRetry()}>
              Try again
            </Button>
          ) : null}
        </div>
      )}
      {!episodes?.length && !isEpisodesLoading && !isEpisodesError && (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-xl bg-card/40 py-12 text-center text-sm text-muted-foreground ring-1 ring-white/5"
        >
          <Tv className="size-6 opacity-60" aria-hidden />
          No episodes for this season yet.
        </div>
      )}
      {shown.length ? (
        <ol className="grid gap-x-4 gap-y-5 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((episode) => {
            const number = episode.episode_number
            const isActive = playingEpisode === number
            const isUpNext = isMounted && !isActive && upNextEpisode === number
            const completed =
              isMounted &&
              isEpisodeCompleted(
                episode.show_id,
                Number(selectedSeason),
                number
              )
            const share = completed
              ? null
              : resumeShare(
                  positions[
                    playbackKey(
                      'tv',
                      episode.show_id,
                      Number(selectedSeason),
                      number
                    )
                  ],
                  episode.runtime
                )
            // isMounted, so the server and the first client pass render the
            // real name and the markup matches. Part-way through counts as
            // chosen, like the one playing: it is not ahead of anybody.
            const masked =
              isMounted &&
              spoilerFree &&
              !completed &&
              !isActive &&
              share === null &&
              !revealed.has(number)

            return (
              <li key={episode.id}>
                <EpisodeCard
                  episode={episode}
                  isActive={isActive}
                  upNextLabel={
                    isUpNext ? upNextText(resume?.isNext) : undefined
                  }
                  completed={completed}
                  masked={masked}
                  share={share}
                  onPlay={() => handleWatchEpisode(episode)}
                  onToggleWatched={() => {
                    trackEpisodeToggled({
                      media_id: episode.show_id,
                      season: Number(selectedSeason),
                      episode: episode.episode_number,
                      completed: !completed,
                    })
                    toggleEpisodeCompleted(buildCompletionMeta(episode))
                  }}
                  onReveal={() => reveal(number)}
                />
              </li>
            )
          })}
        </ol>
      ) : null}
      {hiddenCount > 0 ? (
        <div className="mt-6 flex justify-center">
          <Button
            variant="secondary"
            className="rounded-full px-6"
            onClick={() => setExpandedSeason(selectedSeason)}
          >
            Show all {episodes?.length} episodes
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// "Up next" when the stored episode is finished and we moved past it;
// otherwise the visitor is part-way through and "Continue" is the honest word.
const upNextText = (isNext?: boolean) => (isNext ? 'Up next' : 'Continue')

const playLabel = (
  episode: EpisodeDetails,
  isActive: boolean,
  masked: boolean
) => {
  const name = masked ? '' : `: ${episode.name}`
  const verb = isActive ? 'Playing' : 'Play'
  return `${verb} episode ${episode.episode_number}${name}`
}

interface EpisodeCardProps {
  episode: EpisodeDetails
  isActive: boolean
  /** Set on the episode continue-watching points at. */
  upNextLabel?: string
  completed: boolean
  masked: boolean
  /** 0-1 into the episode, or null when there is nothing to resume. */
  share: number | null
  onPlay: () => void
  onToggleWatched: () => void
  onReveal: () => void
}

/**
 * One episode: its still, its number and name, when it aired, how long it
 * runs, and the first lines of its synopsis.
 *
 * A row of text in a 288px scroll box used to be the whole picker. TMDB sends
 * a still, a synopsis and a runtime with every episode, and services/season-
 * details.ts already keeps them — so the cards cost no request that was not
 * already being made.
 *
 * The card is a stretched button: one <button> covers it and starts the
 * episode, and the two smaller controls (watched, reveal) are SIBLING buttons
 * stacked above it. Nesting them inside the play button, as the rows did, is
 * invalid HTML that left the watched tick as a span pretending to be a button.
 */
const EpisodeCard = React.memo(function EpisodeCard({
  episode,
  isActive,
  upNextLabel,
  completed,
  masked,
  share,
  onPlay,
  onToggleWatched,
  onReveal,
}: EpisodeCardProps) {
  const number = episode.episode_number
  const meta = [
    episode.air_date ? dateFormatter(episode.air_date, true) : null,
    episode.runtime ? `${episode.runtime} min` : null,
  ].filter(Boolean)

  return (
    <div className="group/ep relative flex gap-3 sm:flex-col sm:gap-3">
      {/* The whole card, as one target, and first in the tab order. The
          artwork and text paint over it but take no pointer events, so a
          click anywhere lands here; only the two controls on the still
          (watched, reveal) take their own. */}
      <button
        type="button"
        onClick={onPlay}
        aria-current={isActive ? 'true' : undefined}
        aria-label={playLabel(episode, isActive, masked)}
        className="absolute -inset-1.5 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      />
      <div
        className={cn(
          'pointer-events-none relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-muted shadow-[0_6px_20px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-shadow duration-200 sm:w-full',
          isActive && 'ring-2 ring-primary',
          upNextLabel && 'ring-primary/50'
        )}
      >
        {episode.still_path ? (
          <BlurredImage
            src={getImageURL(episode.still_path)}
            alt=""
            fill
            sizes={STILL_SIZES}
            className={cn(
              'size-full object-cover transition-[transform,filter] duration-300 ease-out group-hover/ep:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover/ep:scale-100',
              masked && 'scale-110 blur-xl group-hover/ep:scale-110',
              completed && 'opacity-80'
            )}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-3xl font-bold text-muted-foreground/40 tabular-nums">
            {number}
          </span>
        )}
        <span
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-black/55 via-transparent to-transparent"
        />
        {/* The play affordance, centred, on hover or keyboard focus — and
            always on the episode that is playing, as the equaliser. */}
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 left-1/2 grid size-10 -translate-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 transition-opacity duration-200 motion-reduce:transition-none sm:size-12',
            'opacity-0 group-focus-within/ep:opacity-100 group-hover/ep:opacity-100',
            isActive && 'bg-primary-fill opacity-100 ring-0'
          )}
        >
          {isActive ? (
            <NowPlayingBars />
          ) : (
            <Play className="size-4 translate-x-px fill-current sm:size-5" />
          )}
        </span>
        <span className="absolute top-1.5 left-1.5 flex flex-wrap items-center gap-1">
          {isActive ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs',
                stateChipClass
              )}
            >
              Now playing
            </span>
          ) : null}
          {upNextLabel ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs',
                stateChipClass
              )}
            >
              {upNextLabel}
            </span>
          ) : null}
          <NewBadgeWhenRecent
            date={episode.air_date}
            withinDays={NEW_EPISODE_DAYS}
            className="static"
          />
        </span>
        {/* Tick off / un-tick. Always shown once ticked, on hover or focus
            otherwise — and always on a touch screen, which has no hover. A
            sibling of the card's play button, not nested in it. */}
        <button
          type="button"
          onClick={onToggleWatched}
          aria-pressed={completed}
          aria-label={
            completed
              ? `Mark episode ${number} as not watched`
              : `Mark episode ${number} as watched`
          }
          className={cn(
            'pointer-events-auto absolute top-1 right-1 grid size-7 cursor-pointer place-items-center rounded-full transition-opacity duration-150 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden sm:top-1.5 sm:right-1.5 sm:size-8',
            completed
              ? 'bg-emerald-500 text-white'
              : 'bg-black/60 text-white opacity-0 ring-1 ring-white/25 group-hover/ep:opacity-100 hover:bg-black/80 [@media(hover:none)]:opacity-100'
          )}
        >
          <Check
            className="size-4"
            strokeWidth={completed ? 3 : 2.25}
            aria-hidden
          />
        </button>
        {masked ? (
          <button
            type="button"
            onClick={onReveal}
            aria-label={`Show episode ${number}`}
            className="pointer-events-auto absolute bottom-1 left-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white ring-1 ring-white/20 hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden sm:bottom-1.5 sm:left-1.5"
          >
            <Eye className="size-3.5" aria-hidden />
            Show
          </button>
        ) : null}
        {share !== null ? (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1 bg-white/25"
          >
            <span
              className="block h-full bg-primary"
              style={{ width: `${Math.round(share * 100)}%` }}
            />
          </span>
        ) : null}
      </div>

      <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1 py-0.5 sm:py-0">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground/70">E{number}</span>
          {meta.map((item) => (
            <React.Fragment key={item}>
              <span aria-hidden>·</span>
              <span>{item}</span>
            </React.Fragment>
          ))}
        </p>
        <h3
          className={cn(
            'line-clamp-2 text-sm leading-snug font-semibold sm:line-clamp-1 sm:text-base',
            isActive && 'text-primary',
            masked && 'font-medium text-muted-foreground italic'
          )}
        >
          {masked ? maskedName(number) : episode.name}
        </h3>
        {!masked && episode.overview ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {episode.overview}
          </p>
        ) : null}
      </div>
    </div>
  )
})

// The loading state, in the shape of what it stands in for.
export const EpisodeSkeletons = () => (
  <ol
    aria-hidden
    className="grid gap-x-4 gap-y-5 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4"
  >
    {Array.from({ length: 8 }, (_, index) => (
      <li key={index} className="flex gap-3 sm:flex-col">
        <span className="block aspect-video w-36 shrink-0 animate-pulse rounded-lg bg-muted/60 sm:w-full" />
        <span className="flex flex-1 flex-col gap-2 py-1">
          <span className="block h-3 w-24 animate-pulse rounded bg-muted/50" />
          <span className="block h-4 w-3/4 animate-pulse rounded bg-muted/60" />
          <span className="block h-3 w-full animate-pulse rounded bg-muted/40" />
        </span>
      </li>
    ))}
  </ol>
)
