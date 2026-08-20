import { describe, expect, it } from 'vitest'

import {
  chooseSeeds,
  dedupe,
  interleave,
  type ForYouItem,
  type SeedCandidate,
} from '@/lib/foryou/routes'

const item = (id: number, because = 'Heat'): ForYouItem => ({
  id,
  type: 'movie',
  title: `Film ${id}`,
  poster_path: null,
  vote_average: null,
  because,
  because_rating: null,
  href: `/movies/${id}`,
})

const candidate = (
  id: number,
  rating: number | null,
  rank: number
): SeedCandidate => ({
  id: String(id),
  type: 'movie',
  title: `Film ${id}`,
  rating,
  rank,
})

describe('interleave', () => {
  it('takes one from each seed before taking a second from any', () => {
    const merged = interleave([
      [item(1), item(2)],
      [item(3)],
      [item(4), item(5)],
    ])
    // Concatenating would put 1 and 2 first and hide the other two seeds below
    // the fold, which makes the row read as "more of that one film".
    expect(merged.map((entry) => entry.id)).toEqual([1, 3, 4, 2, 5])
  })

  it('handles no seeds at all', () => {
    expect(interleave([])).toEqual([])
  })
})

describe('dedupe', () => {
  it('drops anything already in the library', () => {
    const out = dedupe([item(1), item(2)], new Set(['movie:1']), 10)
    expect(out.map((entry) => entry.id)).toEqual([2])
  })

  it('drops a title suggested by two different seeds', () => {
    const out = dedupe([item(1, 'Heat'), item(1, 'Sicario')], new Set(), 10)
    expect(out).toHaveLength(1)
    // The first seed to suggest it is the one credited.
    expect(out[0].because).toBe('Heat')
  })

  it('respects the cap', () => {
    expect(dedupe([item(1), item(2), item(3)], new Set(), 2)).toHaveLength(2)
  })

  it('keys on type as well as id, so movie 550 is not series 550', () => {
    const series: ForYouItem = { ...item(550), type: 'series' }
    const out = dedupe([item(550), series], new Set(), 10)
    expect(out).toHaveLength(2)
  })
})

/**
 * The seeds ARE the feature: everything downstream is one fetch per seed. A
 * wrong order here shows up as a row of recommendations that quietly reads
 * somebody's background noise instead of their taste, which no screenshot
 * catches.
 */
describe('chooseSeeds', () => {
  it('prefers what was rated highly over what was watched last', () => {
    const seeds = chooseSeeds(
      [
        candidate(1, null, 0), // finished most recently, never rated
        candidate(2, 9, 5),
        candidate(3, 7, 9),
      ],
      3
    )
    expect(seeds.map((seed) => seed.id)).toEqual(['2', '3', '1'])
  })

  it('drops anything rated at or below the like threshold', () => {
    // Not ranked last — excluded. "More like the film you gave a 3" is worse
    // than a shorter row.
    const seeds = chooseSeeds([candidate(1, 3, 0), candidate(2, 6, 1)], 3)
    expect(seeds).toEqual([])
  })

  it('keeps unrated titles, which are merely silent rather than negative', () => {
    const seeds = chooseSeeds([candidate(1, null, 0)], 3)
    expect(seeds.map((seed) => seed.id)).toEqual(['1'])
  })

  it('breaks a tie on recency, newest first', () => {
    const seeds = chooseSeeds(
      [candidate(1, 8, 4), candidate(2, 8, 1), candidate(3, 8, 7)],
      2
    )
    expect(seeds.map((seed) => seed.id)).toEqual(['2', '1'])
  })

  it('carries the score through, so the row can say why', () => {
    expect(chooseSeeds([candidate(1, 9.5, 0)], 1)[0].rating).toBe(9.5)
  })
})
