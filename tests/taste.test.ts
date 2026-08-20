import { describe, expect, it } from 'vitest'

import {
  TASTE_MIN,
  tasteMediaType,
  tastePrompt,
  tasteQuery,
  topGenres,
  type TastePick,
} from '@/lib/taste'

const pick = (
  id: number,
  genre_ids: number[],
  type: 'movie' | 'series' = 'movie'
): TastePick => ({
  id,
  type,
  title: `Title ${id}`,
  poster_path: null,
  genre_ids,
})

describe('topGenres', () => {
  it('ranks by how often a genre was picked', () => {
    const picks = [pick(1, [28, 878]), pick(2, [28, 12]), pick(3, [28, 878])]
    expect(topGenres(picks)).toEqual([28, 878, 12])
  })

  it('breaks a tie on what was picked first, not on the genre id', () => {
    // Otherwise the answer is decided by TMDB's numbering, which has nothing to
    // do with anybody's taste.
    expect(topGenres([pick(1, [878, 28])], 2)).toEqual([878, 28])
  })

  it('has an answer for a title with no genres at all', () => {
    expect(topGenres([pick(1, [])])).toEqual([])
  })
})

describe('tasteMediaType', () => {
  it('goes to film unless the picks are mostly shows', () => {
    expect(tasteMediaType([pick(1, [28]), pick(2, [28], 'series')])).toBe(
      'movie'
    )
    expect(
      tasteMediaType([
        pick(1, [28], 'series'),
        pick(2, [28], 'series'),
        pick(3, [28]),
      ])
    ).toBe('tv')
  })
})

describe('tasteQuery', () => {
  it('asks for any of the genres, not all of them', () => {
    // AND across three genres returns almost nothing; the question is "more
    // like these".
    const { params } = tasteQuery([pick(1, [28, 878]), pick(2, [28, 12])])
    expect(params.with_genres).toBe('28,878,12')
    expect(params['vote_count.gte']).toBeGreaterThan(0)
  })
})

describe('tastePrompt', () => {
  it('counts down rather than scolding', () => {
    expect(tastePrompt(0)).toContain(String(TASTE_MIN))
    expect(tastePrompt(1)).toBe(`${TASTE_MIN - 1} more to go.`)
    expect(tastePrompt(5)).toBe('5 picked. Ready when you are.')
  })
})
