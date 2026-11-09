import { describe, expect, it } from 'vitest'

import { parseUntil, splitUntil } from '../scripts/pro-until.mjs'

const NOW = Date.UTC(2026, 10, 9, 14, 0) // 2026-11-09 14:00 UTC

describe('parseUntil', () => {
  it('ends at the start of that day, UTC', () => {
    expect(parseUntil('2027-11-09', NOW)).toBe(Date.UTC(2027, 10, 9))
  })

  it('reads 1y as a year from today', () => {
    expect(parseUntil('1y', NOW)).toBe(Date.UTC(2027, 10, 9))
  })

  it('refuses a date that is not in the future', () => {
    expect(() => parseUntil('2026-11-09', NOW)).toThrow(/future/)
    expect(() => parseUntil('2020-01-01', NOW)).toThrow(/future/)
  })

  it('refuses a date that does not exist rather than rolling it over', () => {
    expect(() => parseUntil('2027-02-30', NOW)).toThrow(/YYYY-MM-DD/)
  })

  it('refuses anything else', () => {
    for (const bad of ['', 'tomorrow', '11/09/2027', '2027-11-9', '2y']) {
      expect(() => parseUntil(bad, NOW)).toThrow(/YYYY-MM-DD/)
    }
  })
})

describe('splitUntil', () => {
  it('takes the value after the flag, whichever side of the email it is on', () => {
    expect(splitUntil(['--until', '1y', 'a@x.com'])).toEqual({
      raw: '1y',
      rest: ['a@x.com'],
    })
    expect(splitUntil(['a@x.com', '--until', '1y'])).toEqual({
      raw: '1y',
      rest: ['a@x.com'],
    })
    expect(splitUntil(['a@x.com', '--until=2027-11-09'])).toEqual({
      raw: '2027-11-09',
      rest: ['a@x.com'],
    })
  })

  it('tells a missing flag from a missing value', () => {
    expect(splitUntil(['a@x.com', '--revoke']).raw).toBeNull()
    expect(splitUntil(['a@x.com', '--until']).raw).toBe('')
  })
})
