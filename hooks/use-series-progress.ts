'use client'

import { useMemo } from 'react'

import { Season, SeriesDetails } from '@/types/series-details'
import { resumeEpisode, type ResumeTarget } from '@/lib/nextup/progress'
import { useCompletedMedia } from '@/hooks/use-completed-media'
import { useLocalStorage, type WatchedItem } from '@/hooks/use-local-storage'
import { useMounted } from '@/hooks/use-mounted'

// false: the stored episode was never finished, so pick it back up.
// true: it IS finished, so this is the first unfinished one after it.
export type ResumePoint = ResumeTarget

export interface SeriesProgress {
  // Null while localStorage is still unread (server render + first paint) and
  // for a series the user has never played. Consumers can render on it directly.
  resume: ResumePoint | null
  completedCount: number
  totalEpisodes: number
  percent: number
  isFinished: boolean
  // localStorage has been read — gate any progress-dependent markup on this or
  // the server HTML and the first client render disagree (hydration mismatch).
  isReady: boolean
}

// Specials (season 0) are excluded from the season walk: TMDB orders them
// outside the main run, so "the next episode after S0E7" is meaningless. A
// resume point that already points INTO season 0 is still honoured — it just
// never auto-advances past the end of it.
const isRegularSeason = (season: Season) =>
  Number(season?.season_number) > 0 && Number(season?.episode_count) > 0

const bySeasonNumber = (a: Season, b: Season) =>
  a.season_number - b.season_number

const episodeKey = (season?: number, episode?: number) => `${season}:${episode}`

const stampOf = (item: WatchedItem) =>
  Date.parse(item.modified_at || item.added_at || '') || 0

// The NEWEST entry for this show with an episode on it. Sync can leave two
// (another device's row arrives under a different season:episode key, and
// nothing tombstones this one), and `find` returned whichever was first in the
// array — routinely the older episode.
const newestEpisodeEntry = (items: WatchedItem[], seriesId: number) => {
  let newest: WatchedItem | undefined
  for (const item of items) {
    if (item.type !== 'series' || item.id !== seriesId) continue
    if (!item.season || !item.episode) continue
    if (!newest || stampOf(item) > stampOf(newest)) newest = item
  }
  return newest
}

// Continue-watching state for ONE series, derived from the two localStorage
// stores the app already keeps: `watchedItems` (the last episode play started
// per show) and `completedItems` (per-episode completion). No new persistence,
// no server round-trip — both stores are shared module-level snapshots, so the
// hero and the season navigator can both call this without extra reads.
export function useSeriesProgress(series?: SeriesDetails): SeriesProgress {
  const [watchedItems] = useLocalStorage('watchedItems', [])
  const { completedItems } = useCompletedMedia()
  const isMounted = useMounted()
  const seriesId = series?.id

  const seasons = useMemo(
    () => (series?.seasons ?? []).filter(isRegularSeason).sort(bySeasonNumber),
    [series?.seasons]
  )

  const totalEpisodes = useMemo(() => {
    const counted = seasons.reduce(
      (sum, season) => sum + season.episode_count,
      0
    )
    return counted || series?.number_of_episodes || 0
  }, [seasons, series?.number_of_episodes])

  const completedKeys = useMemo(() => {
    const keys = new Set<string>()
    if (!seriesId) return keys
    for (const item of completedItems) {
      if (item.type !== 'series' || item.id !== seriesId) continue
      keys.add(episodeKey(item.season, item.episode))
    }
    return keys
  }, [completedItems, seriesId])

  // The same walk the homepage queue answers with (lib/nextup/progress), so
  // "Pick up where you left off" and this page's play button cannot disagree:
  // the episode last played, else the newest one ticked off, then forward.
  const resume = useMemo(() => {
    if (!seriesId) return null
    const last =
      newestEpisodeEntry(watchedItems, seriesId) ??
      newestEpisodeEntry(completedItems, seriesId)
    if (!last?.season || !last?.episode) return null
    return resumeEpisode(
      { season: last.season, episode: last.episode },
      completedKeys,
      seasons
    )
  }, [completedItems, completedKeys, seasons, seriesId, watchedItems])

  // Clamp: a user can tick episodes that TMDB later reshuffles, and a count
  // above the total would render a >100% bar.
  const completedCount = Math.min(completedKeys.size, totalEpisodes || Infinity)
  const percent = totalEpisodes
    ? Math.min(100, Math.round((completedCount / totalEpisodes) * 100))
    : 0

  return {
    resume: isMounted ? resume : null,
    completedCount: isMounted ? completedCount : 0,
    totalEpisodes,
    percent: isMounted ? percent : 0,
    isFinished:
      isMounted && totalEpisodes > 0 && completedCount >= totalEpisodes,
    isReady: isMounted,
  }
}
