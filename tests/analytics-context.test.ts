import { describe, expect, it } from 'vitest'

import { EVENT_AREA, EVENTS } from '@/lib/analytics'
import {
  milestonesFor,
  nextVisit,
  routeTemplate,
  VISIT_GAP_MS,
  visitTraits,
  type VisitRecord,
} from '@/lib/analytics-context'

describe('routeTemplate', () => {
  it.each([
    ['/', '/'],
    ['/movies', '/movies'],
    ['/tv-shows/72071', '/tv-shows/:id'],
    ['/movies/1765072-some-slug', '/movies/:id'],
    ['/movies/year/2019', '/movies/year/:year'],
    ['/tv-shows/genre/drama', '/tv-shows/genre/drama'],
    ['/u/sam', '/u/:id'],
    ['/l/abc123', '/l/:id'],
    ['/person/287', '/person/:id'],
    ['/movies?genre=28', '/movies'],
  ])('%s → %s', (path, expected) => {
    expect(routeTemplate(path)).toBe(expected)
  })
})

const T0 = 1_760_000_000_000

describe('nextVisit', () => {
  it('starts a new browser at visit 1, seeded only if it was seen before', () => {
    expect(nextVisit(null, T0, false).record).toEqual({
      first_at: T0,
      last_at: T0,
      visit_n: 1,
      seeded: false,
    })
    expect(nextVisit(null, T0, true).record.seeded).toBe(true)
  })

  it('counts a new visit only after the inactivity gap', () => {
    const first = nextVisit(null, T0, false).record
    const same = nextVisit(first, T0 + VISIT_GAP_MS, false)
    expect(same.newVisit).toBe(false)
    expect(same.record.visit_n).toBe(1)
    const next = nextVisit(same.record, T0 + 2 * VISIT_GAP_MS + 1, false)
    expect(next.newVisit).toBe(true)
    expect(next.record.visit_n).toBe(2)
    expect(next.record.first_at).toBe(T0)
  })

  it('derives days since first visit and returning status', () => {
    const record: VisitRecord = {
      first_at: T0,
      last_at: T0,
      visit_n: 1,
      seeded: false,
    }
    expect(visitTraits(record, T0 + 3 * 86_400_000 + 5)).toEqual({
      visit_n: 1,
      days_since_first_visit: 3,
      returning_visitor: false,
    })
    expect(visitTraits({ ...record, seeded: true }, T0).returning_visitor).toBe(
      true
    )
  })
})

describe('milestonesFor', () => {
  const fresh: VisitRecord = {
    first_at: T0,
    last_at: T0,
    visit_n: 2,
    seeded: false,
  }
  const none = () => false

  it('a first play earns both first_core_use and first_play, with the time to get there', () => {
    expect(milestonesFor('media_played', fresh, T0 + 90_500, none)).toEqual([
      {
        key: 'first_core_use',
        properties: { since_first_visit_s: 91, visit_n: 2, feature: 'play' },
      },
      {
        key: 'first_play',
        properties: { since_first_visit_s: 91, visit_n: 2 },
      },
    ])
  })

  it('a search first earns first_core_use only', () => {
    const out = milestonesFor('search_performed', fresh, T0, none)
    expect(out.map((m) => m.key)).toEqual(['first_core_use'])
  })

  it('fires nothing once latched, for non-core events, or for a seeded browser', () => {
    expect(milestonesFor('media_played', fresh, T0, () => true)).toEqual([])
    expect(milestonesFor('load_more', fresh, T0, none)).toEqual([])
    expect(
      milestonesFor('media_played', { ...fresh, seeded: true }, T0, none)
    ).toEqual([])
  })
})

describe('prefChanges', () => {
  it('reports only what changed, and never the contents of a structured pref', async () => {
    const { prefChanges } = await import('@/lib/account')
    expect(
      prefChanges(
        { accent: 'blue', autoNext: true, presets: [] },
        {
          accent: 'rose',
          autoNext: true,
          presets: [{ id: 'p', name: 'My secret list' } as never],
        }
      )
    ).toEqual([
      { key: 'accent', value: 'rose' },
      { key: 'presets', value: 'changed' },
    ])
  })
})

describe('EVENT_AREA', () => {
  it('names an area for every event', () => {
    for (const event of Object.values(EVENTS)) {
      expect(EVENT_AREA[event], event).toBeTruthy()
    }
  })
})
