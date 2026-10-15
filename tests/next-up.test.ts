import { describe, expect, it } from 'vitest'

import {
  groupProgress,
  mergeQueue,
  percentWatched,
  queueTarget,
  resumeEpisode,
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

  it('keeps a show started at S01E01 alive, and resumes that episode', () => {
    // The old queue dropped these entirely: pressing play on the first
    // episode marks nothing "completed", so the show did not exist. Then it
    // counted the play AS a finish and answered E2, while the show's own page
    // said "Resume S1 · E1". Pressing play is not finishing.
    const entries = mergeQueue([row('history', 'series:1396:1:1', 100)])
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('series')
    expect([...entries[0].watched]).toEqual([])
    expect(queueTarget(entries[0], SEASONS)).toEqual({
      season: 1,
      episode: 1,
      isNext: false,
    })
  })

  it('resumes the episode last played, never the first gap', () => {
    // The reported bug: a show started mid-way, or finished on a player that
    // never said so, and "pick up where you left off" opened S01E01 because
    // that was the first episode nobody had ticked off.
    const entries = mergeQueue([row('history', 'series:1399:2:1', 100)])
    expect(queueTarget(entries[0], SEASONS)).toEqual({
      season: 2,
      episode: 1,
      isNext: false,
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
    expect(queueTarget(entries[0], SEASONS)).toEqual({
      season: 2,
      episode: 1,
      isNext: false,
    })
  })

  it('moves on once the last-played episode is finished', () => {
    const entries = mergeQueue([
      row('history', 'series:1399:1:3', 100),
      row('completed', 'series:1399:1:3', 150),
    ])
    expect(queueTarget(entries[0], SEASONS)).toEqual({
      season: 2,
      episode: 1,
      isNext: true,
    })
  })

  it('follows the newest play when two devices left two history rows', () => {
    const entries = mergeQueue([
      row('history', 'series:1399:1:2', 100),
      row('history', 'series:1399:2:2', 300),
      row('history', 'series:1399:1:3', 200),
    ])
    expect(entries).toHaveLength(1)
    expect(queueTarget(entries[0], SEASONS)).toMatchObject({
      season: 2,
      episode: 2,
    })
  })

  it('walks on from the newest tick when nothing was ever played', () => {
    const entries = mergeQueue([
      row('completed', 'series:1399:1:2', 200),
      row('completed', 'series:1399:1:1', 100),
    ])
    expect(queueTarget(entries[0], SEASONS)).toEqual({
      season: 1,
      episode: 3,
      isNext: true,
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

describe('resumeEpisode', () => {
  const at = (season: number, episode: number) => ({ season, episode })

  it('picks an unfinished episode back up', () => {
    expect(resumeEpisode(at(1, 2), watched('1:1'), SEASONS)).toEqual({
      season: 1,
      episode: 2,
      isNext: false,
    })
  })

  it('goes to the following episode once it is finished', () => {
    expect(resumeEpisode(at(1, 1), watched('1:1'), SEASONS)).toEqual({
      season: 1,
      episode: 2,
      isNext: true,
    })
  })

  it('skips episodes already ticked off ahead of it', () => {
    expect(
      resumeEpisode(at(1, 1), watched('1:1', '1:2', '1:3'), SEASONS)
    ).toEqual({ season: 2, episode: 1, isNext: true })
  })

  it('never walks back to an earlier gap', () => {
    // Skipped S01E02. The bookmark is where you are; the hole is history.
    expect(resumeEpisode(at(2, 1), watched('1:1', '2:1'), SEASONS)).toEqual({
      season: 2,
      episode: 2,
      isNext: true,
    })
  })

  it('rolls into the next season, never into the specials', () => {
    expect(resumeEpisode(at(1, 3), watched('1:3'), SEASONS)).toEqual({
      season: 2,
      episode: 1,
      isNext: true,
    })
  })

  it('returns null when everything aired is behind you', () => {
    expect(resumeEpisode(at(2, 2), watched('2:2'), SEASONS)).toBeNull()
  })

  it('ignores seasons TMDB reports as empty', () => {
    expect(
      resumeEpisode(at(1, 1), watched('1:1'), [
        { season_number: 1, episode_count: 1 },
        { season_number: 2, episode_count: 0 },
        { season_number: 3, episode_count: 1 },
      ])
    ).toEqual({ season: 3, episode: 1, isNext: true })
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
