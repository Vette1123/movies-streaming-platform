import { describe, expect, it } from 'vitest'

import {
  dedupeCards,
  interleave,
  resolveMatches,
  type MatchCard,
  type SwipeRecord,
} from '@/lib/match-night'

const swipe = (
  swiper: string,
  mediaId: number,
  liked: boolean,
  mediaType: 'movie' | 'tv' = 'movie'
): SwipeRecord => ({ swiper, mediaId, mediaType, liked })

describe('resolveMatches', () => {
  it('matches when two different people liked the same title', () => {
    const matches = resolveMatches([
      swipe('a', 100, true),
      swipe('b', 100, true),
    ])
    expect(matches).toEqual([
      { mediaId: 100, mediaType: 'movie', likers: ['a', 'b'] },
    ])
  })

  it('never matches a single person liking twice', () => {
    expect(resolveMatches([swipe('a', 100, true)])).toEqual([])
  })

  it('does not let one super-liker match themselves', () => {
    const swipes = [
      swipe('solo', 1, true),
      swipe('solo', 2, true),
      swipe('solo', 3, true),
    ]
    expect(resolveMatches(swipes)).toEqual([])
  })

  it('ignores dislikes', () => {
    expect(
      resolveMatches([swipe('a', 5, false), swipe('b', 5, false)])
    ).toEqual([])
  })

  it('keeps movie and tv identities separate', () => {
    const swipes = [
      swipe('a', 7, true, 'movie'),
      swipe('b', 7, true, 'movie'),
      swipe('a', 7, true, 'tv'),
    ]
    const matches = resolveMatches(swipes)
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ mediaType: 'movie', likers: ['a', 'b'] })
  })

  it('matches tv titles too', () => {
    const matches = resolveMatches([
      swipe('a', 9, true, 'tv'),
      swipe('b', 9, true, 'tv'),
    ])
    expect(matches[0]?.mediaType).toBe('tv')
  })
})

describe('interleave', () => {
  it('alternates movies and shows', () => {
    expect(interleave(['m1', 'm2'], ['t1', 't2'])).toEqual([
      'm1',
      't1',
      'm2',
      't2',
    ])
  })

  it('appends the longer tail', () => {
    expect(interleave(['m1', 'm2', 'm3'], ['t1'])).toEqual([
      'm1',
      't1',
      'm2',
      'm3',
    ])
  })

  it('handles empty sides', () => {
    expect(interleave([], ['t1', 't2'])).toEqual(['t1', 't2'])
    expect(interleave([], [])).toEqual([])
  })
})

describe('dedupeCards', () => {
  const card = (id: number, mediaType: 'movie' | 'tv'): MatchCard => ({
    id,
    mediaType,
    title: `${mediaType} ${id}`,
    poster: null,
    year: '2020',
    rating: 7,
  })

  it('keeps a film and a series that share a TMDB id', () => {
    // TMDB numbers movies and series in separate namespaces, so 1399 is both
    // a film and a series. Keying on the id alone dropped one of them.
    const out = dedupeCards([card(1399, 'movie'), card(1399, 'tv')])
    expect(out).toHaveLength(2)
  })

  it('still drops a true repeat, first occurrence winning', () => {
    const first = card(42, 'movie')
    const out = dedupeCards([first, card(42, 'movie')])
    expect(out).toEqual([first])
  })
})
