import { describe, expect, it } from 'vitest'

import {
  isManaged,
  layoutTiles,
  MANAGED,
  section,
  sectionBody,
} from '../scripts/lib/posthog-insights.mjs'
import { AFTER_BOT_BLOCK, HUMANS } from '../scripts/lib/posthog.mjs'
import { pct, unpivot } from '../scripts/posthog-comparisons.mjs'
import {
  ALERTS,
  DASHBOARDS,
  PROJECT_SETTINGS,
} from '../scripts/posthog-dashboards.mjs'

type Box = { x: number; y: number; w: number; h: number }
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('layoutTiles', () => {
  it('packs left to right, wraps, and starts every section on its own row', () => {
    const placed = layoutTiles([
      section('A'),
      { name: 'k1', size: 'kpi' },
      { name: 'k2', size: 'kpi' },
      { name: 'h1', size: 'half' },
      { name: 'h2', size: 'half' },
      section('B'),
      { name: 'f', size: 'full' },
    ])
    const at = Object.fromEntries(
      placed.map(({ item, layout }) => [item.name ?? item.section, layout])
    )
    expect(at.A).toEqual({ x: 0, y: 0, w: 12, h: 1 })
    expect(at.k1).toMatchObject({ x: 0, y: 1 })
    expect(at.k2).toMatchObject({ x: 3, y: 1 })
    expect(at.h1).toMatchObject({ x: 6, y: 1 })
    // h2 does not fit beside h1, so it wraps below the tallest tile in the row.
    expect(at.h2).toMatchObject({ x: 0, y: 6 })
    expect(at.B).toEqual({ x: 0, y: 11, w: 12, h: 1 })
    expect(at.f).toMatchObject({ x: 0, y: 12, w: 12 })
  })

  it('keeps a section with a note to one row (no dead space, no scroll)', () => {
    const [{ layout }] = layoutTiles([
      section('Money', 'From nudge to supporter.'),
    ])
    expect(layout).toEqual({ x: 0, y: 0, w: 12, h: 1 })
  })

  it('refuses an unknown size instead of dropping the tile', () => {
    expect(() => layoutTiles([{ name: 'x', size: 'huge' }])).toThrow(/huge/)
  })

  it('writes a section as ONE markdown heading line carrying its note', () => {
    const body = sectionBody(section('Money', 'From nudge to supporter.'))
    expect(body).toBe('### Money — From nudge to supporter.')
    expect(body).not.toContain('\n')
  })
})

describe('the dashboard spec', () => {
  for (const board of DASHBOARDS) {
    it(`${board.name}: no two tiles overlap and none leaves the grid`, () => {
      const boxes = layoutTiles(board.tiles).map((p) => p.layout)
      for (const [i, a] of boxes.entries()) {
        expect(a.x + a.w).toBeLessThanOrEqual(12)
        for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false)
      }
    })

    it(`${board.name}: tile names are unique (setup matches by name)`, () => {
      const names = board.tiles.filter((t) => t.query).map((t) => t.name)
      expect(new Set(names).size).toBe(names.length)
    })

    it(`${board.name}: every HogQL chart names its axes, from its own columns`, () => {
      // Without chartSettings PostHog folded a 62-row line into one dot.
      const charts = board.tiles.filter(
        (t) =>
          t.query?.kind === 'DataVisualizationNode' &&
          !['ActionsTable', 'BoldNumber'].includes(t.query.display)
      )
      for (const tile of charts) {
        const settings = tile.query.chartSettings
        expect(settings, tile.name).toBeDefined()
        const columns = [
          settings.xAxis.column,
          ...settings.yAxis.map((y: { column: string }) => y.column),
        ]
        for (const column of columns)
          expect(tile.query.source.query, `${tile.name}: ${column}`).toMatch(
            new RegExp(`\\b${column}\\b`)
          )
      }
    })

    it(`${board.name}: every tile counts real people only`, () => {
      for (const tile of board.tiles.filter((t) => t.query)) {
        const { source } = tile.query
        if (source.kind === 'HogQLQuery') {
          expect(source.query, tile.name).toContain(HUMANS)
        } else expect(source.filterTestAccounts, tile.name).toBe(true)
      }
    })
  }

  it('drops pre-bot-block events from every Trends/Funnel tile', () => {
    // Without it a 90-day window draws the August fleet: the "100,000 users" bug.
    const keys = PROJECT_SETTINGS.test_account_filters.map((f) => f.key)
    expect(keys).toContain(AFTER_BOT_BLOCK)
  })

  it('puts every alert tile on a board', () => {
    const names = new Set(DASHBOARDS.flatMap((b) => b.tiles.map((t) => t.name)))
    for (const alert of ALERTS) expect(names.has(alert.tile.name)).toBe(true)
  })
})

describe('isManaged', () => {
  it('owns an insight on a spec board or carrying the legacy marker, never a twin elsewhere', () => {
    expect(isManaged({ dashboards: [7] }, [7, 8])).toBe(true)
    expect(
      isManaged({ description: `x ${MANAGED}`, dashboards: [] }, [7])
    ).toBe(true)
    expect(isManaged({ description: 'mine', dashboards: [99] }, [7])).toBe(
      false
    )
    expect(isManaged({}, [7])).toBe(false)
  })
})

describe('comparison helpers', () => {
  it('pct handles both-zero, from-zero and signed changes', () => {
    expect(pct('a', 'b')).toContain(`'from 0'`)
    expect(pct('a', 'b')).toContain(`concat('+'`)
  })

  it('unpivot reads every metric from one scan', () => {
    const sql = unpivot(
      [
        ['Plays', 'up', 'count()', 'count()'],
        ['Fails', 'down', 'count()', 'count()'],
      ],
      'true'
    )
    expect(sql.match(/FROM events/g)).toHaveLength(1)
    expect(sql).toContain(`(1, 'Fails', 'down', toInt(m1_0), toInt(m1_1))`)
  })
})
