import { describe, expect, it } from 'vitest'

import { dedupe, interleave, type ForYouItem } from '@/lib/foryou/routes'

const item = (id: number, because = 'Heat'): ForYouItem => ({
  id,
  type: 'movie',
  title: `Film ${id}`,
  poster_path: null,
  vote_average: null,
  because,
  href: `/movies/${id}`,
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
