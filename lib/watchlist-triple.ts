import { MINUTES_PER_EPISODE, MINUTES_PER_FILM } from '@/lib/stats'
import type { WatchedItem } from '@/hooks/use-local-storage'

/**
 * A "good enough for one evening" budget in minutes. Three films can blow past
 * this; the picker prefers a set under it when one exists, otherwise returns
 * three anyway with the overrun visible in the total (a triple that overruns is
 * still a triple).
 */
export const EVENING_MINUTES = 180

const DAY_MS = 86_400_000

/** UTC day number for a timestamp — the seed changes once per day, not per render. */
export function daySeed(now: number = Date.now()): number {
  return Math.floor(now / DAY_MS)
}

/**
 * Minutes for one sitting, preferring the stored runtime over the stats average.
 * Same rule as lib/stats.ts's totalMinutes, applied to a single row.
 */
export function minutesFor(item: WatchedItem): number {
  if (typeof item.runtime === 'number' && item.runtime > 0) return item.runtime
  return item.type === 'movie' ? MINUTES_PER_FILM : MINUTES_PER_EPISODE
}

/** FNV-1a — deterministic across JS engines, unlike Math.random or Date.hashCode. */
function hash(seed: number, item: WatchedItem): number {
  const key = `${seed}:${item.type}:${item.id}`
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Pick three watchlist rows for "tonight", deterministically from `seed`.
 *
 * Same seed → same triple (so a day's pick is stable across renders and
 * navigations); a new seed (new day, or the Spin control) reshuffles. Prefers
 * the seed's own top three when they fit {@link EVENING_MINUTES}; otherwise the
 * three shortest; otherwise the seed triple with an honest overrun total.
 *
 * Pure: no Date.now(), no Math.random — the seed is an argument, which is what
 * makes the day-stability and the "Spin again" control share one code path.
 */
export function pickTriple(
  items: WatchedItem[],
  seed: number
): WatchedItem[] {
  if (items.length < 3) return []

  const shuffled = [...items].sort((a, b) => {
    const d = hash(seed, a) - hash(seed, b)
    return d !== 0 ? d : a.id - b.id
  })

  // Pass 1: the seed's own top three, when they fit the evening.
  const seedTriple = shuffled.slice(0, 3)
  if (tripleMinutes(seedTriple) <= EVENING_MINUTES) return seedTriple

  // Pass 2: that roll overran — try the three shortest (stable sort keeps the
  // seed order among equals). Still over? Hand back the seed triple and let the
  // total line say so.
  const byLength = [...shuffled].sort((a, b) => minutesFor(a) - minutesFor(b))
  const shortTriple = byLength.slice(0, 3)
  if (tripleMinutes(shortTriple) <= EVENING_MINUTES) return shortTriple

  return seedTriple
}

/** Total minutes for a triple, for the "about Xh Ym" line under the heading. */
export function tripleMinutes(triple: WatchedItem[]): number {
  return triple.reduce((sum, item) => sum + minutesFor(item), 0)
}
