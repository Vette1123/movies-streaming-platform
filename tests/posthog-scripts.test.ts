import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  boardRows,
  firstOf,
  hiddenBecause,
  ownFrames,
} from '../scripts/lib/board-filters.mjs'
import {
  areaOf,
  areaReach,
  areaTables,
  neverFired,
  whatToDo,
} from '../scripts/lib/usage-report.mjs'

describe('error board filters', () => {
  const row = { id: 'a', last_seen: '2026-10-20T10:00:00Z' }

  it('hides closed issues and ledger fixes until a fresh event after the grace day', () => {
    expect(hiddenBecause(row, 'resolved', {})).toBe('resolved')
    expect(hiddenBecause(row, 'active', {})).toBeNull()
    expect(hiddenBecause(row, 'active', { a: { fixedOn: '2026-10-20' } })).toBe(
      'fixed-in-ledger'
    )
    // Seen two days after the fix: a regression, so it shows again.
    const regression = { id: 'a', last_seen: '2026-10-22T10:00:00Z' }
    expect(
      hiddenBecause(regression, 'active', { a: { fixedOn: '2026-10-20' } })
    ).toBeNull()
  })

  it('counts every hidden row by reason', () => {
    const rows = [
      { id: 'a', last_seen: '2026-10-20T00:00:00Z' },
      { id: 'b', last_seen: '2026-10-20T00:00:00Z' },
      { id: 'c', last_seen: '2026-10-20T00:00:00Z' },
    ]
    const status = new Map([
      ['a', 'resolved'],
      ['b', 'active'],
    ])
    const { shown, hidden } = boardRows(rows, status, {})
    expect(shown.map((r: { id: string }) => r.id)).toEqual(['b', 'c'])
    expect(hidden).toEqual({ resolved: 1 })
  })

  it('reads HogQL JSON-text arrays and keeps only our own frames', () => {
    expect(firstOf('["TypeError","x"]')).toBe('TypeError')
    const list = JSON.stringify([
      {
        stacktrace: {
          frames: [
            { source: 'chrome-extension://x/inject.js', line: 1 },
            {
              source: 'https://www.reely.space/_next/static/chunks/a.js',
              line: 9,
              resolved_name: 'play',
            },
          ],
        },
      },
    ])
    expect(ownFrames(list)).toEqual(['_next/static/chunks/a.js:9 play'])
  })
})

describe('usage report', () => {
  const tables = areaTables(
    readFileSync(path.join(__dirname, '..', 'lib', 'analytics.ts'), 'utf8')
  )

  it('reads both area tables out of lib/analytics.ts', () => {
    expect(tables.eventArea.media_played).toBe('playback')
    expect(tables.featureArea.match_night).toBe('social')
    expect(areaOf({ event: 'feature_used', feature: 'mood' }, tables)).toBe(
      'discover'
    )
  })

  it('reach is the max over an area, as a share of active people', () => {
    const reach = areaReach(
      [
        { event: 'media_played', people: 30, people_before: 20 },
        { event: 'player_failed', people: 10, people_before: 5 },
      ],
      tables,
      100,
      100
    )
    expect(reach).toEqual([
      {
        area: 'playback',
        people: 30,
        before: 20,
        share: 0.3,
        share_before: 0.2,
      },
    ])
  })

  it('lists events nobody sent', () => {
    const unseen = neverFired([{ event: 'media_played', people: 3 }], tables)
    expect(unseen).toContain('watchlist_added')
    expect(unseen).not.toContain('media_played')
  })

  it('ranks actions and names the number behind each', () => {
    const todo = whatToDo({
      reach: [],
      activation: { new_people: 100, rate: 0.1 },
      player: [{ source: 'x', plays: 20, failures: 15 }],
      support: { cta: 12, checkout: 0 },
      rage: [{ route: '/movies', c: 30 }],
    })
    expect(todo).toHaveLength(4)
    expect(todo[0]).toContain('10% of 100')
    expect(todo[1]).toContain('"x" failed 15 times')
  })
})
