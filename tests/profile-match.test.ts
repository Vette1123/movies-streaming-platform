import { describe, expect, it } from 'vitest'

import { matchBlurb, matchTopRated } from '@/lib/profile/match'
import type { ProfileTitle } from '@/lib/profile/routes'

const title = (
  id: number,
  type: 'movie' | 'series' = 'movie',
  name = `Title ${id}`
): ProfileTitle => ({
  id,
  type,
  title: name,
  poster_path: null,
  rating: 8,
})

describe('matchTopRated', () => {
  it('returns an empty match and score 0 when neither shelf has anything', () => {
    // Union 0 must not read as 100% — two empty lists are not perfect taste.
    const match = matchTopRated([], [])
    expect(match.score).toBe(0)
    expect(match.shared).toEqual([])
    expect(match.onlyA).toEqual([])
    expect(match.onlyB).toEqual([])
  })

  it('scores 100 when the two lists are the same titles', () => {
    const list = [title(1), title(2), title(3)]
    const match = matchTopRated(list, [...list].reverse())
    expect(match.score).toBe(100)
    expect(match.shared).toHaveLength(3)
    expect(match.onlyA).toEqual([])
    expect(match.onlyB).toEqual([])
  })

  it('splits shared and unique titles, keeping each side’s order', () => {
    const match = matchTopRated(
      [title(1), title(2), title(3)],
      [title(3), title(2), title(9)]
    )
    expect(match.shared.map((t) => t.id)).toEqual([2, 3])
    expect(match.onlyA.map((t) => t.id)).toEqual([1])
    expect(match.onlyB.map((t) => t.id)).toEqual([9])
    // |{2,3}| / |{1,2,3,9}| = 50
    expect(match.score).toBe(50)
  })

  it('never matches a film to a series that shares its TMDB id', () => {
    // Movie 603 and series 603 are different titles; a bare numeric key would
    // report a shared favourite neither person rated.
    const match = matchTopRated([title(603, 'movie')], [title(603, 'series')])
    expect(match.shared).toEqual([])
    expect(match.score).toBe(0)
    expect(match.onlyA).toHaveLength(1)
    expect(match.onlyB).toHaveLength(1)
  })

  it('rounds the Jaccard score to a whole percent', () => {
    // 1 shared / 3 union = 33.33… → 33
    const match = matchTopRated(
      [title(1), title(2)],
      [title(1), title(8)]
    )
    expect(match.score).toBe(33)
  })
})

describe('matchBlurb', () => {
  it('names the shared count, including zero and one', () => {
    const none = matchTopRated([title(1)], [title(2)])
    expect(matchBlurb(none)).toBe('No titles in both rated-highest lists.')

    const one = matchTopRated([title(1)], [title(1)])
    expect(matchBlurb(one)).toBe('One title in both rated-highest lists.')

    const two = matchTopRated([title(1), title(2)], [title(2), title(1)])
    expect(matchBlurb(two)).toBe('2 titles in both rated-highest lists.')
  })
})
