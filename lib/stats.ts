import type { WatchedItem } from '@/hooks/use-local-storage'

/**
 * The fallback runtimes, for rows that do not carry a real one.
 *
 * They used to be the ONLY runtimes. Reely stored what you watched and not how
 * long it was, so every hours figure on the site was two averages multiplied by
 * two counts, and the copy said "about" because that was the honest word for
 * it.
 *
 * It no longer has to be. `buildWatchedItem` writes the real runtime onto every
 * row it creates, taken from the TMDB payload the page it was created on had
 * already fetched — free at the only moment it is free. Rows recorded before
 * that shipped still land here, and lib/stats/routes.ts fills in whatever the
 * alert sweep happens to know about them, so the share of guessed rows only
 * ever goes down.
 *
 * Kept, rather than deleted, because a library is a long-lived thing and the
 * alternative to a labelled estimate is a wrong total presented as a fact.
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
  /**
   * How many of the rows behind `hours` carried a real runtime, and how many
   * were counted at all. The UI says "about" only when these disagree, which
   * is what stops a precise number being presented as if it were measured.
   */
  exactRuntimes: number
  countedRuntimes: number
  streak: number
  busiestMonth: string | null
  firstAt: number | null
  lastAt: number | null
  saved: number
}

/** `movie:550` — the same key shape the sync engine and the sweep both use. */
const runtimeKey = (item: WatchedItem): string => `${item.type}:${item.id}`

/**
 * Minutes watched, preferring what is known over what is assumed.
 *
 * Per ROW rather than per title: one completed row is one film or one episode,
 * and a series row carries the runtime of a single episode, so summing rows is
 * already the right arithmetic. The fallback is chosen by the row's own type,
 * which is why a library of 400 episodes and 3 films does not get averaged into
 * nonsense.
 *
 * Pure and separate so the "did it count everything exactly once" question can
 * be tested directly. An hours figure that quietly doubles is the kind of bug
 * nobody reports and everybody notices.
 */
function totalMinutes(
  completed: WatchedItem[],
  backfill?: Record<string, number>
): { total: number; exact: number; counted: number } {
  let total = 0
  let exact = 0

  for (const item of completed) {
    const known = item.runtime ?? backfill?.[runtimeKey(item)]
    if (typeof known === 'number' && known > 0) {
      total += known
      exact++
      continue
    }
    total += item.type === 'movie' ? MINUTES_PER_FILM : MINUTES_PER_EPISODE
  }

  return { total, exact, counted: completed.length }
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
  saved: number,
  /**
   * Runtimes recovered from the server for rows that predate `runtime` being
   * stored, keyed `movie:550` / `series:1399`. Optional: everything here works
   * without it, only less precisely.
   */
  backfill?: Record<string, number>
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

  const minutes = totalMinutes(completed, backfill)

  return {
    films,
    episodes,
    seriesStarted,
    hours: Math.round(minutes.total / 60),
    exactRuntimes: minutes.exact,
    countedRuntimes: minutes.counted,
    streak,
    busiestMonth: busiest ? busiest[0] : null,
    firstAt,
    lastAt,
    saved,
  }
}

/**
 * Whether every row behind the hours figure carried a real runtime.
 *
 * The word "about" on screen is load-bearing: it is the difference between an
 * honest estimate and a fabricated measurement. It has to disappear when the
 * number stops being an estimate, and it has to come back for the library that
 * still has pre-runtime rows in it, which is why this is a function of the
 * stats rather than a flag set once.
 */
export const isExact = (stats: LibraryStats): boolean =>
  stats.countedRuntimes > 0 && stats.exactRuntimes === stats.countedRuntimes

/** The label under the big number, which must not overclaim. */
export const hoursLabel = (stats: LibraryStats): string =>
  isExact(stats) ? 'hours watched' : 'hours, roughly'

/** How the figure was arrived at, said plainly. */
export function runtimeSource(stats: LibraryStats): string {
  if (stats.countedRuntimes === 0) return 'Nothing counted yet'
  if (isExact(stats)) return 'Every title, exactly'
  const share = Math.round((stats.exactRuntimes / stats.countedRuntimes) * 100)
  return `${share}% exact, the rest averaged`
}

/**
 * The year a row belongs to, read off the stamp the rest of this file sorts by.
 *
 * The string is ISO and therefore UTC, so a title finished at 11pm on the 31st
 * of December in a western timezone counts as the following year. That is the
 * same slice `dayOf` and the busiest-month key already take, and being
 * consistent with them matters more here than being right about four hours.
 */
const yearOf = (item: WatchedItem): number | null => {
  const year = Number((item.modified_at || item.added_at || '').slice(0, 4))
  return Number.isFinite(year) && year > 1900 ? year : null
}

/**
 * Narrow a store to one year, or hand it back whole.
 *
 * `null` means all time and is not a special case anywhere else: every figure
 * on the stats page is `computeStats` over whatever rows it is given, so
 * scoping the input is the entire feature. Nothing downstream knows a year
 * exists.
 */
export function inYear(
  items: WatchedItem[],
  year: number | null
): WatchedItem[] {
  if (year === null) return items
  return items.filter((item) => yearOf(item) === year)
}

/**
 * Which years this library actually has something in, newest first.
 *
 * Offering a year with nothing in it would be a picker that leads to an empty
 * card, so the choices come from the rows rather than from a range.
 */
export function libraryYears(...stores: WatchedItem[][]): number[] {
  const years = new Set<number>()
  for (const store of stores) {
    for (const item of store) {
      const year = yearOf(item)
      if (year !== null) years.add(year)
    }
  }
  return [...years].sort((a, b) => b - a)
}
