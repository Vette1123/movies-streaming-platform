import { describe, expect, it } from 'vitest'

import { computeStats, inYear, libraryYears } from '@/lib/stats'
import { cardFileName, eyebrow, headlineOf } from '@/lib/stats-card'
import type { WatchedItem } from '@/hooks/use-local-storage'

const at = (stamp: string, over: Partial<WatchedItem> = {}): WatchedItem => ({
  id: 550,
  type: 'movie',
  title: 'Fight Club',
  overview: '',
  backdrop_path: '',
  poster_path: '',
  added_at: stamp,
  modified_at: stamp,
  ...over,
})

const LIBRARY = [
  at('2024-03-02T20:00:00.000Z', { id: 1 }),
  at('2025-11-30T20:00:00.000Z', { id: 2 }),
  at('2026-01-05T20:00:00.000Z', { id: 3 }),
  at('2026-02-05T20:00:00.000Z', { id: 4 }),
]

describe('inYear', () => {
  it('hands the store back whole for all time', () => {
    // null is the default scope, and has to be free — the year picker is an
    // opt-in, not a filter everything now goes through.
    expect(inYear(LIBRARY, null)).toBe(LIBRARY)
  })

  it('keeps only the rows stamped in that year', () => {
    expect(inYear(LIBRARY, 2026).map((item) => item.id)).toEqual([3, 4])
    expect(inYear(LIBRARY, 2023)).toEqual([])
  })

  it('reads the year off modified_at, which is when it was watched', () => {
    // A film saved in 2024 and finished in 2026 belongs to 2026 — added_at is
    // only the fallback for rows that never moved.
    const late = at('2026-06-01T00:00:00.000Z', {
      added_at: '2024-01-01T00:00:00.000Z',
    })
    expect(inYear([late], 2026)).toHaveLength(1)
    expect(inYear([late], 2024)).toHaveLength(0)
  })
})

describe('libraryYears', () => {
  it('offers newest first, once each, across every store', () => {
    expect(libraryYears(LIBRARY, [at('2025-01-01T00:00:00.000Z')])).toEqual([
      2026, 2025, 2024,
    ])
  })

  it('offers nothing for rows with no usable stamp', () => {
    expect(libraryYears([at('', { added_at: '', modified_at: '' })])).toEqual(
      []
    )
  })
})

describe('computeStats over a scoped year', () => {
  it('counts only what the scope contains', () => {
    // The whole feature is that nothing downstream knows a year exists: the
    // figures are the same function over fewer rows.
    const scoped = computeStats([], inYear(LIBRARY, 2026), 0)
    expect(scoped.films).toBe(2)
    expect(computeStats([], LIBRARY, 0).films).toBe(4)
  })
})

describe('card wording', () => {
  it('names the year everywhere it appears', () => {
    expect(eyebrow(2026)).toBe('MY 2026 ON REELY')
    expect(headlineOf('Sam', 2026)).toBe("Sam's 2026")
    expect(cardFileName(2026)).toBe('reely-2026.png')
  })

  it('still reads as a sentence with either fact missing', () => {
    expect(eyebrow(null)).toBe('MY YEAR ON REELY')
    expect(headlineOf('Sam', null)).toBe("Sam's viewing")
    expect(headlineOf(null, 2026)).toBe('Everything in 2026')
    expect(headlineOf(null, null)).toBe('A year of viewing')
    expect(cardFileName(null)).toBe('reely-year.png')
  })
})
