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
  it('is stable within a UTC day and moves at midnight', () => {
    const before = Date.parse('2026-09-22T23:59:59.999Z')
    const after = Date.parse('2026-09-23T00:00:00.000Z')
    expect(daySeed(before)).toBe(daySeed(before - 1000))
    expect(daySeed(after)).not.toBe(daySeed(before))
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
