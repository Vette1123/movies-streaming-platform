import type { WatchedItem } from '@/hooks/use-local-storage'

/**
 * Rough runtimes, and named as rough on screen.
 *
 * Reely stores what you watched, not how long it was — the runtime lives on a
 * TMDB detail payload the stats page has no business fetching a thousand of. So
 * the hours are an estimate from two averages, and the copy says "about".
 * Inventing a precise-looking number from data we do not have would be worse
 * than an honest approximation.
 */
const MINUTES_PER_EPISODE = 42
const MINUTES_PER_FILM = 115

const DAY_MS = 24 * 60 * 60 * 1000

const dayOf = (value: string): string => value.slice(0, 10)

const parsed = (item: WatchedItem): number => {
  const stamp = Date.parse(item.modified_at || item.added_at || '')
  return Number.isFinite(stamp) ? stamp : 0
}

export interface LibraryStats {
  films: number
  episodes: number
  seriesStarted: number
  hours: number
  streak: number
  busiestMonth: string | null
  firstAt: number | null
  lastAt: number | null
  saved: number
}

/**
 * Everything the stats page shows, from the two local stores.
 *
 * Pure, and in lib/ rather than in the component, so the arithmetic can be
 * tested without a renderer: a streak that counts wrong, or an hours figure that
 * quietly doubles, is the kind of bug nobody reports and everybody notices.
 */
export function computeStats(
  history: WatchedItem[],
  completed: WatchedItem[],
  saved: number
): LibraryStats {
  const episodes = completed.filter((item) => item.type === 'series').length
  const films = completed.filter((item) => item.type === 'movie').length
  const seriesStarted = new Set(
    history.filter((item) => item.type === 'series').map((item) => item.id)
  ).size

  const stamps = [...history, ...completed]
    .map(parsed)
    .filter(Boolean)
    .sort((a, b) => a - b)
  const firstAt = stamps[0] ?? null
  const lastAt = stamps[stamps.length - 1] ?? null

  // One entry per day, so ten episodes in an evening is one day of the streak
  // rather than ten.
  const days = new Set(
    [...history, ...completed]
      .map((item) => item.modified_at || item.added_at)
      .filter(Boolean)
      .map(dayOf)
  )
  const sortedDays = [...days].sort()

  let streak = 0
  let run = 0
  let previous: number | null = null
  for (const day of sortedDays) {
    const time = Date.parse(`${day}T00:00:00Z`)
    run = previous !== null && time - previous === DAY_MS ? run + 1 : 1
    previous = time
    if (run > streak) streak = run
  }

  const months = new Map<string, number>()
  for (const item of [...history, ...completed]) {
    const key = (item.modified_at || item.added_at || '').slice(0, 7)
    if (!key) continue
    months.set(key, (months.get(key) ?? 0) + 1)
  }
  const busiest = [...months.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    films,
    episodes,
    seriesStarted,
    hours: Math.round(
      (episodes * MINUTES_PER_EPISODE + films * MINUTES_PER_FILM) / 60
    ),
    streak,
    busiestMonth: busiest ? busiest[0] : null,
    firstAt,
    lastAt,
    saved,
  }
}
