import { describe, expect, it } from 'vitest'

import { normaliseItem, normaliseItems, slugify } from '@/lib/lists/routes'
import { hasAired, seriesState } from '@/lib/push/sweep'
import { computeStats } from '@/lib/stats'
import type { WatchedItem } from '@/hooks/use-local-storage'

const NOW = Date.parse('2026-08-15T12:00:00Z')

describe('normaliseItem', () => {
  const base = { id: 1399, type: 'series', title: 'Game of Thrones' }

  it('accepts a well-formed item', () => {
    expect(normaliseItem({ ...base, poster_path: '/abc123.jpg' })).toEqual({
      id: 1399,
      type: 'series',
      title: 'Game of Thrones',
      poster_path: '/abc123.jpg',
    })
  })

  it('refuses a poster path that is not one', () => {
    // It is concatenated into an image URL, so it is validated by shape rather
    // than accepted for being a string.
    for (const poster of [
      'https://evil.example/x.jpg',
      '/../../etc/passwd',
      '/a b.jpg',
      42,
    ]) {
      expect(normaliseItem({ ...base, poster_path: poster })?.poster_path).toBe(
        null
      )
    }
  })

  it('rounds a rating to one place and drops one out of range', () => {
    expect(normaliseItem({ ...base, rating: 7.4999999 })?.rating).toBe(7.5)
    expect(normaliseItem({ ...base, rating: 0 })?.rating).toBeUndefined()
    expect(normaliseItem({ ...base, rating: 11 })?.rating).toBeUndefined()
    expect(normaliseItem({ ...base, rating: 'great' })?.rating).toBeUndefined()
  })

  it('refuses an item with no usable identity', () => {
    expect(normaliseItem(null)).toBeNull()
    expect(normaliseItem({ ...base, id: 0 })).toBeNull()
    expect(normaliseItem({ ...base, id: 'abc' })).toBeNull()
    expect(normaliseItem({ ...base, title: '   ' })).toBeNull()
  })

  it('treats any type that is not "series" as a film', () => {
    expect(normaliseItem({ ...base, type: 'anything' })?.type).toBe('movie')
  })
})

describe('normaliseItems', () => {
  const item = (id: number, type = 'movie') => ({ id, type, title: `#${id}` })

  it('drops duplicates of the same title', () => {
    expect(normaliseItems([item(1), item(1), item(2)])).toHaveLength(2)
  })

  it('keeps a film and a series that share an id', () => {
    expect(normaliseItems([item(1, 'movie'), item(1, 'series')])).toHaveLength(
      2
    )
  })

  it('caps the list and survives a non-array', () => {
    const many = Array.from({ length: 700 }, (_, i) => item(i + 1))
    expect(normaliseItems(many)).toHaveLength(500)
    expect(normaliseItems('nope')).toEqual([])
  })
})

describe('slugify', () => {
  it('is URL-safe and carries the random suffix', () => {
    expect(slugify('Weekend Watchlist', 'abc123')).toBe(
      'weekend-watchlist-abc123'
    )
  })

  it('strips accents rather than the letters under them', () => {
    expect(slugify('Café Noir', 'x')).toBe('cafe-noir-x')
  })

  it('never produces a bare suffix with no name', () => {
    expect(slugify('!!!', 'x')).toBe('list-x')
    expect(slugify('', 'x')).toBe('list-x')
  })
})

describe('hasAired', () => {
  it('compares dates, not instants', () => {
    expect(hasAired('2026-08-15', NOW)).toBe(true)
    expect(hasAired('2026-08-14', NOW)).toBe(true)
    expect(hasAired('2026-08-16', NOW)).toBe(false)
    expect(hasAired(null, NOW)).toBe(false)
    expect(hasAired(undefined, NOW)).toBe(false)
  })
})

describe('seriesState', () => {
  const series = {
    name: 'Severance',
    last_episode_to_air: {
      air_date: '2026-08-14',
      season_number: 3,
      episode_number: 2,
      name: 'The Door',
    },
    next_episode_to_air: {
      air_date: '2026-08-21',
      season_number: 3,
      episode_number: 3,
      name: 'Outside',
    },
  }

  it('announces an episode that has aired and was never announced', () => {
    const state = seriesState(series, null, '95396', NOW)
    expect(state.announce?.title).toContain('Severance')
    expect(state.announce?.url).toBe('/tv-shows/95396')
    expect(state.nextAirDate).toBe('2026-08-21')
  })

  it('announces it exactly once', () => {
    const first = seriesState(series, null, '95396', NOW)
    const again = seriesState(series, first.announce!.key, '95396', NOW)
    expect(again.announce).toBeNull()
  })

  it('says nothing about an episode that has not aired yet', () => {
    const unaired = {
      ...series,
      last_episode_to_air: {
        ...series.last_episode_to_air,
        air_date: '2026-09-01',
      },
    }
    expect(seriesState(unaired, null, '95396', NOW).announce).toBeNull()
  })

  it('says nothing about a series with no episodes at all', () => {
    expect(seriesState({ name: 'Unaired' }, null, '1', NOW).announce).toBeNull()
  })

  it('takes the first episode runtime, and nothing when there is none', () => {
    expect(
      seriesState({ ...series, episode_run_time: [42, 60] }, null, '1', NOW)
        .runtime
    ).toBe(42)
    expect(seriesState(series, null, '1', NOW).runtime).toBeNull()
    // TMDB reports 0 for titles it has no figure for, which is not a runtime.
    expect(
      seriesState({ ...series, episode_run_time: [0] }, null, '1', NOW).runtime
    ).toBeNull()
  })
})

describe('computeStats', () => {
  const at = (iso: string, over: Partial<WatchedItem> = {}) =>
    ({
      id: 1,
      type: 'series',
      title: 'A show',
      added_at: iso,
      modified_at: iso,
      ...over,
    }) as WatchedItem

  it('counts films and episodes separately', () => {
    const stats = computeStats(
      [],
      [
        at('2026-08-01T00:00:00Z'),
        at('2026-08-01T01:00:00Z'),
        at('2026-08-02T00:00:00Z', { id: 550, type: 'movie' }),
      ],
      3
    )
    expect(stats.episodes).toBe(2)
    expect(stats.films).toBe(1)
    expect(stats.saved).toBe(3)
    // 2 * 42 + 115 = 199 minutes.
    expect(stats.hours).toBe(3)
  })

  it('counts a streak in days, not in entries', () => {
    const stats = computeStats(
      [],
      [
        at('2026-08-01T20:00:00Z'),
        at('2026-08-01T21:00:00Z'),
        at('2026-08-02T20:00:00Z'),
        at('2026-08-03T20:00:00Z'),
        // Gap, then a shorter run.
        at('2026-08-09T20:00:00Z'),
      ],
      0
    )
    expect(stats.streak).toBe(3)
  })

  it('orders timestamps numerically, so "first tracked" is the earliest', () => {
    const stats = computeStats(
      [],
      [at('2026-08-10T00:00:00Z'), at('2019-01-01T00:00:00Z')],
      0
    )
    expect(stats.firstAt).toBe(Date.parse('2019-01-01T00:00:00Z'))
    expect(stats.lastAt).toBe(Date.parse('2026-08-10T00:00:00Z'))
  })

  it('is all zeroes and nulls for an empty library', () => {
    const stats = computeStats([], [], 0)
    expect(stats).toMatchObject({
      films: 0,
      episodes: 0,
      hours: 0,
      streak: 0,
      busiestMonth: null,
      firstAt: null,
    })
  })
})
