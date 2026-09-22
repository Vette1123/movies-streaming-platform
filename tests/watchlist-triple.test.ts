import { describe, expect, it } from 'vitest'

import { MINUTES_PER_EPISODE, MINUTES_PER_FILM } from '@/lib/stats'
import {
  daySeed,
  EVENING_MINUTES,
  minutesFor,
  pickTriple,
  tripleMinutes,
} from '@/lib/watchlist-triple'
import type { WatchedItem } from '@/hooks/use-local-storage'

const row = (
  id: number,
  type: 'movie' | 'series',
  runtime?: number
): WatchedItem => ({
  id,
  type,
  title: `${type} ${id}`,
  overview: '',
  backdrop_path: '',
  poster_path: '',
  runtime,
  added_at: '2026-09-01T00:00:00.000Z',
  modified_at: '2026-09-01T00:00:00.000Z',
})

describe('daySeed', () => {
  it('is stable within a day and moves at midnight', () => {
    const before = Date.parse('2026-09-22T23:59:59.999Z')
    const after = Date.parse('2026-09-23T00:00:00.000Z')
    expect(daySeed(before, 0)).toBe(daySeed(before - 1000, 0))
    expect(daySeed(after, 0)).not.toBe(daySeed(before, 0))
  })

  it('rolls over at LOCAL midnight, not UTC', () => {
    // UTC+3 (offset -180): 22:00Z is already 01:00 the next local day, and
    // 20:00Z is 23:00 the same local day — the evening must not flip at 03:00.
    const lateEvening = Date.parse('2026-09-22T20:00:00.000Z')
    const pastMidnight = Date.parse('2026-09-22T22:00:00.000Z')
    const earlyEvening = Date.parse('2026-09-22T15:00:00.000Z')
    expect(daySeed(lateEvening, -180)).toBe(daySeed(earlyEvening, -180))
    expect(daySeed(pastMidnight, -180)).not.toBe(daySeed(lateEvening, -180))
  })
})

describe('minutesFor', () => {
  it('prefers a stored runtime', () => {
    expect(minutesFor(row(1, 'movie', 97))).toBe(97)
    expect(minutesFor(row(2, 'series', 38))).toBe(38)
  })

  it('falls back by type when runtime is missing or zero', () => {
    expect(minutesFor(row(1, 'movie'))).toBe(MINUTES_PER_FILM)
    expect(minutesFor(row(2, 'series'))).toBe(MINUTES_PER_EPISODE)
    expect(minutesFor(row(3, 'movie', 0))).toBe(MINUTES_PER_FILM)
    expect(minutesFor(row(4, 'series', 0))).toBe(MINUTES_PER_EPISODE)
  })
})

describe('pickTriple', () => {
  const shortList = [
    row(1, 'movie', 90),
    row(2, 'movie', 90),
    row(3, 'movie', 90),
  ]

  it('returns [] when the list has fewer than three items', () => {
    expect(pickTriple([], 1)).toEqual([])
    expect(pickTriple(shortList.slice(0, 2), 1)).toEqual([])
  })

  it('is deterministic for the same seed', () => {
    const many = Array.from({ length: 20 }, (_, i) => row(i + 1, 'movie', 80))
    const a = pickTriple(many, 42)
    const b = pickTriple(many, 42)
    expect(a).toEqual(b)
    expect(a).toHaveLength(3)
    expect(new Set(a.map((x) => x.id)).size).toBe(3)
  })

  it('reshuffles for a different seed', () => {
    const many = Array.from({ length: 40 }, (_, i) => row(i + 1, 'movie', 60))
    const ids = new Set<number>()
    for (let seed = 0; seed < 20; seed++) {
      for (const item of pickTriple(many, seed)) ids.add(item.id)
    }
    // With 40 candidates and 20 seeds, a non-variety bug would collapse this.
    expect(ids.size).toBeGreaterThan(5)
  })

  it('prefers a combination under the evening budget when one exists', () => {
    // One long film would blow the budget alone if picked first; three 50-min
    // rows fit together.
    const mixed = [
      row(1, 'movie', 170),
      row(2, 'movie', 50),
      row(3, 'movie', 50),
      row(4, 'movie', 50),
    ]
    const picked = pickTriple(mixed, 7)
    expect(picked).toHaveLength(3)
    expect(tripleMinutes(picked)).toBeLessThanOrEqual(EVENING_MINUTES)
  })

  it('still returns three when nothing fits the budget', () => {
    const long = [
      row(1, 'movie', 200),
      row(2, 'movie', 200),
      row(3, 'movie', 200),
    ]
    const picked = pickTriple(long, 1)
    expect(picked).toHaveLength(3)
    expect(tripleMinutes(picked)).toBe(600)
  })
})

describe('tripleMinutes', () => {
  it('sums minutesFor across the triple', () => {
    expect(tripleMinutes([row(1, 'movie', 90), row(2, 'series', 45)])).toBe(135)
    expect(tripleMinutes([])).toBe(0)
  })
})

describe('pickTriple spin variety', () => {
  it('keeps reshuffling a mixed list whose films never fit the evening', () => {
    // Ten films at the 115 fallback + five series: any triple with a film
    // overruns, so every fitting triple is three series. The old pass 2 took
    // "the three shortest" and returned the SAME three on every spin.
    const items = [
      ...Array.from({ length: 10 }, (_, i) => row(i + 1, 'movie')),
      // Real episode lengths, all distinct: equal ones let a stable sort keep
      // the seed order among ties, and short ones (~30) let a film fit beside
      // two series — either hides the bug this test exists for. These are the
      // runtimes it was caught with in the browser.
      ...[47, 51, 55, 58, 60].map((minutes, i) =>
        row(100 + i, 'series', minutes)
      ),
    ]
    const picks = Array.from({ length: 12 }, (_, spin) =>
      pickTriple(items, 20_000 * 1000 + spin)
    )
    const sets = new Set(
      picks.map((triple) =>
        triple
          .map((item) => item.id)
          .sort((x, y) => x - y)
          .join(',')
      )
    )
    // Measured: 6 distinct sets in 12 spins (10 fitting triples exist); the
    // old shortest-three pass gave 1, and a plain greedy walk barely more — it
    // takes a film first, strands itself at two, and falls back.
    expect(sets.size).toBeGreaterThanOrEqual(4)
    for (const triple of picks) {
      expect(tripleMinutes(triple)).toBeLessThanOrEqual(EVENING_MINUTES)
    }
  })
})
