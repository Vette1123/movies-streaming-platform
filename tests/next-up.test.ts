import { describe, expect, it } from 'vitest'

import {
  groupProgress,
  mergeQueue,
  nextEpisode,
  percentWatched,
  type QueueRow,
} from '@/lib/nextup/progress'

/**
 * The queue is the one feature that can be confidently, quietly wrong: an
 * off-by-one sends somebody to an episode they have already watched, and the
 * only symptom is a spoiler. So the walk is pinned here rather than eyeballed.
 */
const SEASONS = [
  { season_number: 0, episode_count: 4 },
  { season_number: 1, episode_count: 3 },
  { season_number: 2, episode_count: 2 },
]

const watched = (...keys: string[]) => new Set(keys)

const row = (
  store: string,
  item_key: string,
  updated_at: number,
  payload: QueueRow['payload'] = null
): QueueRow => ({ store, item_key, payload, updated_at })

describe('groupProgress', () => {
  it('groups episode keys by series, newest show first', () => {
    const groups = groupProgress([
      { item_key: 'series:1399:1:1', updated_at: 10 },
      { item_key: 'series:1399:1:2', updated_at: 20 },
      { item_key: 'series:66732:1:1', updated_at: 50 },
    ])
    expect(groups.map((group) => group.id)).toEqual(['66732', '1399'])
    expect(groups[1].watched).toEqual(watched('1:1', '1:2'))
    // The newest touch on the show, not the first one seen.
    expect(groups[1].lastAt).toBe(20)
  })

  it('ignores anything that is not a series episode', () => {
    const groups = groupProgress([
      { item_key: 'movie:550', updated_at: 1 },
      { item_key: 'series:1399', updated_at: 2 },
      { item_key: 'series:abc:1:1', updated_at: 3 },
    ])
    expect(groups).toEqual([])
  })
})

describe('mergeQueue — anything you played is in the queue', () => {
  const filmPayload = JSON.stringify({
    title: 'Fight Club',
    poster_path: '/pB8BM7pdsp6BbAiNkPWmdFsnf4s.jpg',
  })

  it('turns a played film from history into a queue entry', () => {
    const entries = mergeQueue([row('history', 'movie:550', 100, filmPayload)])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: '550',
      kind: 'movie',
      title: 'Fight Club',
      posterPath: '/pB8BM7pdsp6BbAiNkPWmdFsnf4s.jpg',
    })
  })

  it('keeps a show started at S01E01 alive even with nothing ticked off', () => {
    // The old queue dropped these entirely: pressing play on the first
    // episode marks nothing "completed", so the show did not exist.
    const entries = mergeQueue([row('history', 'series:1396:1:1', 100)])
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('series')
    expect([...entries[0].watched]).toEqual(['1:1'])
    // And the walk answers E2, not "no such show".
    expect(nextEpisode(entries[0].watched, SEASONS)).toEqual({
      season: 1,
      episode: 2,
    })
  })

  it('merges history and completion for the same show instead of listing it twice', () => {
    const entries = mergeQueue([
      row('completed', 'series:1399:1:1', 50),
      row('completed', 'series:1399:1:2', 60),
      row('completed', 'series:1399:1:3', 70),
      // Pressed play on the season-two opener afterwards (hero resume).
      row('history', 'series:1399:2:1', 200),
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0].lastAt).toBe(200)
    expect([...entries[0].watched]).toEqual(['1:1', '1:2', '1:3'])
    expect(nextEpisode(entries[0].watched, SEASONS)).toEqual({
      season: 2,
      episode: 1,
    })
  })

  it('does not resurface a film that has been ticked off as completed', () => {
    const entries = mergeQueue([
      row('history', 'movie:550', 300, filmPayload),
      row('completed', 'movie:550', 400),
    ])
    expect(entries).toEqual([])
  })

  it('sorts films and shows together by last touch', () => {
    const entries = mergeQueue([
      row('history', 'series:1399:1:1', 100),
      row('history', 'movie:550', 500, filmPayload),
      row('history', 'series:66732:1:1', 250),
    ])
    expect(entries.map((entry) => entry.id)).toEqual(['550', '66732', '1399'])
  })

  it('skips unparseable payloads and non-episode keys rather than guessing', () => {
    const entries = mergeQueue([
      row('history', 'movie:550', 100, '{not json'),
      row('history', 'series:1399', 110),
      row('watchlist', 'movie:603', 120, filmPayload),
      row('resume', 'movie:27205', 130, '{"position_seconds":600}'),
    ])
    expect(entries).toEqual([])
  })
})

describe('nextEpisode', () => {
  it('starts at the first episode when nothing has been watched', () => {
    expect(nextEpisode(watched(), SEASONS)).toEqual({ season: 1, episode: 1 })
  })

  it('returns the first GAP, not the one after the highest watched', () => {
    // Watched S02E01 out of curiosity, then went back and started season one.
    // The honest answer is where the hole is, not where the bookmark would be.
    expect(nextEpisode(watched('1:1', '2:1'), SEASONS)).toEqual({
      season: 1,
      episode: 2,
    })
  })

  it('rolls into the next season', () => {
    expect(nextEpisode(watched('1:1', '1:2', '1:3'), SEASONS)).toEqual({
      season: 2,
      episode: 1,
    })
  })

  it('skips specials entirely', () => {
    // Season 0 has four episodes and none are watched; it must never be offered.
    const next = nextEpisode(watched(), SEASONS)
    expect(next?.season).not.toBe(0)
  })

  it('returns null when the show is finished', () => {
    expect(
      nextEpisode(watched('1:1', '1:2', '1:3', '2:1', '2:2'), SEASONS)
    ).toBeNull()
  })

  it('ignores seasons TMDB reports as empty', () => {
    expect(
      nextEpisode(watched(), [
        { season_number: 1, episode_count: 0 },
        { season_number: 2, episode_count: 1 },
      ])
    ).toEqual({ season: 2, episode: 1 })
  })
})

describe('percentWatched', () => {
  it('counts against the real seasons only', () => {
    // Five real episodes, three watched. The four specials are not the total.
    expect(percentWatched(watched('1:1', '1:2', '1:3'), SEASONS)).toBe(60)
  })

  it('never exceeds 100 when TMDB reorganises a season', () => {
    expect(
      percentWatched(watched('1:1', '1:2', '1:3'), [
        { season_number: 1, episode_count: 2 },
      ])
    ).toBe(100)
  })

  it('is zero rather than NaN for a show with no episodes', () => {
    expect(percentWatched(watched(), [])).toBe(0)
  })
})
