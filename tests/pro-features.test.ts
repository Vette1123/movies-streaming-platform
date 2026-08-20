import { describe, expect, it } from 'vitest'

import {
  MAX_PRESETS,
  normalisePresets,
  withoutPreset,
  withPreset,
} from '@/lib/filter-presets'
import {
  mergeAnnounced,
  newProviders,
  parseProviderMap,
  providerAnnouncement,
  providerMap,
} from '@/lib/push/providers'
import { computeStats, hoursLabel, isExact } from '@/lib/stats'
import { normaliseRuntimeKeys } from '@/lib/stats/routes'
import type { WatchedItem } from '@/hooks/use-local-storage'

const item = (over: Partial<WatchedItem> = {}): WatchedItem => ({
  id: 1,
  type: 'movie',
  title: 'A film',
  overview: '',
  backdrop_path: '',
  poster_path: '',
  added_at: '2026-01-01T00:00:00.000Z',
  modified_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

// ---------------------------------------------------------------------------
// Hours watched. The failure mode is a number that looks measured and is not,
// or one that quietly double-counts — neither shows up in a smoke test.
// ---------------------------------------------------------------------------

describe('hours watched', () => {
  it('sums the real runtimes when every row carries one', () => {
    const completed = [
      item({ id: 1, runtime: 120 }),
      item({ id: 2, runtime: 60 }),
    ]
    const stats = computeStats([], completed, 0)
    expect(stats.hours).toBe(3)
    expect(isExact(stats)).toBe(true)
    expect(hoursLabel(stats)).toBe('hours watched')
  })

  it('falls back per row, by that row own type', () => {
    const completed = [
      item({ id: 1, type: 'movie' }), // 115
      item({ id: 2, type: 'series' }), // 42
    ]
    const stats = computeStats([], completed, 0)
    expect(stats.hours).toBe(Math.round(157 / 60))
    expect(isExact(stats)).toBe(false)
    expect(hoursLabel(stats)).toBe('hours, roughly')
  })

  it('uses the server backfill only where the row has no runtime', () => {
    const completed = [
      item({ id: 550, runtime: 139 }),
      item({ id: 1399, type: 'series' }),
    ]
    const stats = computeStats([], completed, 0, {
      'movie:550': 999,
      'series:1399': 60,
    })
    expect(stats.hours).toBe(Math.round(199 / 60))
    expect(isExact(stats)).toBe(true)
  })

  it('ignores a zero runtime rather than counting it', () => {
    const stats = computeStats([], [item({ runtime: 0 })], 0)
    expect(stats.hours).toBe(Math.round(115 / 60))
    expect(stats.exactRuntimes).toBe(0)
  })

  it('counts history rows for streaks but never for hours', () => {
    // One title watched and finished appears in BOTH stores. Counting hours
    // from the union would double it.
    const same = item({ id: 7, runtime: 120 })
    const stats = computeStats([same], [same], 0)
    expect(stats.hours).toBe(2)
    expect(stats.countedRuntimes).toBe(1)
  })

  it('says nothing was counted on an empty library', () => {
    const stats = computeStats([], [], 0)
    expect(stats.hours).toBe(0)
    expect(isExact(stats)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Now-streaming alerts. The failure mode here is a notification storm.
// ---------------------------------------------------------------------------

const payload = (results: Record<string, unknown>) => ({ results }) as never

describe('watch providers', () => {
  it('keeps subscription and free, drops rent and buy', () => {
    const map = providerMap(
      payload({
        US: {
          flatrate: [{ provider_name: 'Netflix' }],
          free: [{ provider_name: 'Tubi' }],
          rent: [{ provider_name: 'Apple TV' }],
          buy: [{ provider_name: 'Amazon' }],
        },
      })
    )
    expect(map).toEqual({ US: 'Netflix|Tubi' })
  })

  it('sorts and de-duplicates, so the string is a stable signature', () => {
    const a = providerMap(
      payload({
        US: {
          flatrate: [{ provider_name: 'Max' }, { provider_name: 'Netflix' }],
        },
      })
    )
    const b = providerMap(
      payload({
        US: {
          flatrate: [{ provider_name: 'Netflix' }, { provider_name: 'Max' }],
        },
      })
    )
    expect(a).toEqual(b)
  })

  it('drops regions nobody can subscribe to alerts for', () => {
    const map = providerMap(
      payload({ ZZ: { flatrate: [{ provider_name: 'X' }] } })
    )
    expect(map).toEqual({})
  })

  it('is SILENT on a first sighting', () => {
    // The whole backlog of every watchlist on the site would otherwise fire at
    // once the first time this shipped.
    expect(newProviders({ US: 'Netflix' }, {})).toEqual({})
  })

  it('announces only what is new, only in the region it is new in', () => {
    const fresh = newProviders(
      { US: 'Max|Netflix', GB: 'Now' },
      { US: 'Netflix', GB: 'Now' }
    )
    expect(fresh).toEqual({ US: ['Max'] })
  })

  it('says nothing when a title LEAVES a service', () => {
    expect(newProviders({ US: 'Netflix' }, { US: 'Max|Netflix' })).toEqual({})
  })

  it('records a region even when it announced nothing, so the next change lands', () => {
    const merged = mergeAnnounced({}, { US: 'Netflix' })
    expect(merged).toEqual({ US: 'Netflix' })
    expect(newProviders({ US: 'Max|Netflix' }, merged)).toEqual({ US: ['Max'] })
  })

  it('keeps a region TMDB stopped reporting rather than treating it as a loss', () => {
    expect(mergeAnnounced({ GB: 'Now' }, { US: 'Netflix' })).toEqual({
      GB: 'Now',
      US: 'Netflix',
    })
  })

  it('survives a null, an empty and a malformed column', () => {
    expect(parseProviderMap(null)).toEqual({})
    expect(parseProviderMap('')).toEqual({})
    expect(parseProviderMap('not json')).toEqual({})
    expect(parseProviderMap('[1,2]')).toEqual({})
    expect(parseProviderMap('{"US":"Netflix","GB":7}')).toEqual({
      US: 'Netflix',
    })
  })

  it('reads as a sentence for one service and for several', () => {
    expect(providerAnnouncement('Dune', ['Max'], 'US').body).toBe(
      'Now on Max in United States.'
    )
    expect(providerAnnouncement('Dune', ['Max', 'Hulu'], 'GB').body).toBe(
      'Now on Max and Hulu in United Kingdom.'
    )
  })
})

// ---------------------------------------------------------------------------
// Saved filters. The cap is the point: prefs is one column rewritten whole.
// ---------------------------------------------------------------------------

describe('filter presets', () => {
  it('accepts a well-formed preset and normalises the query', () => {
    expect(
      normalisePresets([
        { id: 'abcd1234', name: '  Horror   90s ', query: '?g=27&y=1990' },
      ])
    ).toEqual([{ id: 'abcd1234', name: 'Horror 90s', query: 'g=27&y=1990' }])
  })

  it('drops the malformed rather than failing the whole save', () => {
    const out = normalisePresets([
      { id: 'ok1234', name: 'Keep', query: 'a=1' },
      { id: 'no', name: 'Bad id', query: 'a=1' },
      { id: 'ok5678', name: '   ', query: 'a=1' },
      { id: 'ok9012', name: 'No query', query: '' },
      'nonsense',
    ])
    expect(out.map((p) => p.name)).toEqual(['Keep'])
  })

  it('refuses duplicate ids', () => {
    const out = normalisePresets([
      { id: 'abcd12', name: 'One', query: 'a=1' },
      { id: 'abcd12', name: 'Two', query: 'b=2' },
    ])
    expect(out).toHaveLength(1)
  })

  it('caps the list', () => {
    const many = Array.from({ length: MAX_PRESETS + 5 }, (_, i) => ({
      id: `id${String(i).padStart(4, '0')}`,
      name: `P${i}`,
      query: `a=${i}`,
    }))
    expect(normalisePresets(many)).toHaveLength(MAX_PRESETS)
  })

  it('replaces by name rather than growing a second row with the same label', () => {
    const first = withPreset([], { id: 'aaaa11', name: 'Horror', query: 'a=1' })
    const second = withPreset(first, {
      id: 'bbbb22',
      name: 'horror',
      query: 'a=2',
    })
    expect(second).toHaveLength(1)
    expect(second[0].query).toBe('a=2')
  })

  it('removes by id and leaves the rest alone', () => {
    const list = [
      { id: 'aaaa11', name: 'A', query: 'a=1' },
      { id: 'bbbb22', name: 'B', query: 'b=2' },
    ]
    expect(withoutPreset(list, 'aaaa11')).toEqual([list[1]])
  })
})

// ---------------------------------------------------------------------------
// The runtime backfill request. Bounds only; the answer is a D1 read.
// ---------------------------------------------------------------------------

describe('runtime backfill keys', () => {
  it('accepts only real media keys', () => {
    expect(
      normaliseRuntimeKeys([
        'movie:550',
        'series:1399',
        'movie:550:1:2',
        'person:5',
        'movie:abc',
        'movie:550', // duplicate
        42,
        null,
      ])
    ).toEqual(['movie:550', 'series:1399'])
  })

  it('is empty for anything that is not a list', () => {
    expect(normaliseRuntimeKeys(null)).toEqual([])
    expect(normaliseRuntimeKeys('movie:550')).toEqual([])
  })

  it('caps how large one query can get', () => {
    const many = Array.from({ length: 900 }, (_, i) => `movie:${i}`)
    expect(normaliseRuntimeKeys(many)).toHaveLength(400)
  })
})
