import { localDayNumber } from '@/lib/local-day'
import { MINUTES_PER_EPISODE, MINUTES_PER_FILM } from '@/lib/stats'
import type { WatchedItem } from '@/hooks/use-local-storage'

/**
 * A "good enough for one evening" budget in minutes. Three films can blow past
 * this; the picker prefers a set under it when one exists, otherwise returns
 * three anyway with the overrun visible in the total (a triple that overruns is
 * still a triple).
 */
export const EVENING_MINUTES = 180

/** The seed changes once per LOCAL day, not per render — see lib/local-day. */
export const daySeed = localDayNumber

/** One sitting in words: a series row is ONE episode, and should say so. */
export function sittingLabel(item: WatchedItem, duration: string): string {
  return item.type === 'series' ? `1 ep · ${duration}` : duration
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
 * navigations); a new seed (new day, or the Spin control) reshuffles. Returns
 * the first triple in seed order that fits {@link EVENING_MINUTES} — the seed's
 * own top three when they fit — and the raw seed triple, with an honest overrun
 * total, only when no three titles fit at all.
 *
 * Pure: no Date.now(), no Math.random — the seed is an argument, which is what
 * makes the day-stability and the "Spin again" control share one code path.
 */
export function pickTriple(items: WatchedItem[], seed: number): WatchedItem[] {
  if (items.length < 3) return []

  const shuffled = [...items].sort((a, b) => {
    const d = hash(seed, a) - hash(seed, b)
    return d !== 0 ? d : a.id - b.id
  })

  const seedTriple = shuffled.slice(0, 3)
  const byLength = [...shuffled].sort((a, b) => minutesFor(a) - minutesFor(b))
  // The three shortest are the smallest possible total: if they overrun,
  // nothing fits, and the seed triple goes back with the overrun shown.
  if (tripleMinutes(byLength.slice(0, 3)) > EVENING_MINUTES) return seedTriple

  // Can `picked` still become a triple that fits? Only if topping it up with
  // the shortest titles left does.
  const completes = (picked: WatchedItem[]): boolean => {
    const rest = byLength.filter((item) => !picked.includes(item))
    const topUp = rest.slice(0, 3 - picked.length)
    return tripleMinutes(picked) + tripleMinutes(topUp) <= EVENING_MINUTES
  }

  // Walk the seed's order, keeping each title that still leaves room for a
  // fitting triple. One pass is enough — room only shrinks as the pick grows,
  // so a title skipped once could never have fitted later. When the seed's top
  // three fit, this returns exactly them. The seed chooses every slot, which
  // is what keeps Spin reshuffling: this used to fall back to "the three
  // shortest", the same three series on every spin of any list with a film.
  const picked: WatchedItem[] = []
  for (const item of shuffled) {
    if (completes([...picked, item])) picked.push(item)
    if (picked.length === 3) return picked
  }
  return seedTriple
}

/** Total minutes for a triple, for the "about Xh Ym" line under the heading. */
export function tripleMinutes(triple: WatchedItem[]): number {
  return triple.reduce((sum, item) => sum + minutesFor(item), 0)
}
