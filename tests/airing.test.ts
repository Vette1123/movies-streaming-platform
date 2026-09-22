import { describe, expect, it } from 'vitest'

import { airingLabel } from '@/lib/airing'

// A fixed "now": 2026-09-22T12:00:00Z — noon UTC, mid-day, so floor-to-UTC
// midnight is unambiguous in either direction of a timezone.
const NOW = Date.parse('2026-09-22T12:00:00Z')

describe('airingLabel', () => {
  it('returns null for missing, empty or unparseable dates', () => {
    expect(airingLabel(undefined, NOW, 0)).toBeNull()
    expect(airingLabel(null, NOW, 0)).toBeNull()
    expect(airingLabel('', NOW, 0)).toBeNull()
    expect(airingLabel('not-a-date', NOW, 0)).toBeNull()
  })

  it('returns null for a date that has already passed', () => {
    expect(airingLabel('2026-09-21', NOW, 0)).toBeNull()
    expect(airingLabel('2026-09-22T00:00:00Z', NOW, 0)).not.toBeNull()
  })

  it('flags today and tomorrow as urgent', () => {
    expect(airingLabel('2026-09-22', NOW, 0)).toEqual({
      label: 'Airs today',
      urgent: true,
    })
    expect(airingLabel('2026-09-23', NOW, 0)).toEqual({
      label: 'Airs tomorrow',
      urgent: true,
    })
  })

  it('counts calendar days apart, not a duration', () => {
    // 01:00 UTC tomorrow is only 13 hours away — still "tomorrow" before the
    // floor, and "today" after it once now crosses midnight.
    const justPastMidnight = Date.parse('2026-09-23T01:00:00Z')
    expect(airingLabel('2026-09-23', justPastMidnight, 0)?.label).toBe(
      'Airs today'
    )
    // 23:00 UTC today is 11 hours before midnight — still "today".
    const lateToday = Date.parse('2026-09-22T23:00:00Z')
    expect(airingLabel('2026-09-22', lateToday, 0)?.label).toBe('Airs today')
  })

  it("counts on the visitor's calendar, not UTC's", () => {
    // 00:30Z on the 23rd is 20:30 on the 22nd in New York (EDT, offset 240):
    // tonight's episode is still "today" there, though UTC has moved on.
    const newYorkEvening = Date.parse('2026-09-23T00:30:00Z')
    expect(airingLabel('2026-09-22', newYorkEvening, 240)?.label).toBe(
      'Airs today'
    )
    expect(airingLabel('2026-09-23', newYorkEvening, 240)?.label).toBe(
      'Airs tomorrow'
    )
    // 22:30Z on the 22nd is 01:30 on the 23rd in Cairo (offset -180).
    const cairoNight = Date.parse('2026-09-22T22:30:00Z')
    expect(airingLabel('2026-09-23', cairoNight, -180)?.label).toBe(
      'Airs today'
    )
  })

  it('uses a relative label inside a week and a date beyond it', () => {
    expect(airingLabel('2026-09-24', NOW, 0)).toEqual({
      label: 'Airs in 2 days',
      urgent: false,
    })
    expect(airingLabel('2026-09-29', NOW, 0)).toEqual({
      label: 'Airs in 7 days',
      urgent: false,
    })
    const far = airingLabel('2026-11-15', NOW, 0)
    expect(far?.urgent).toBe(false)
    expect(far?.label).toMatch(/^Airs /)
    expect(far?.label).toContain('November')
  })

  it('reads an ISO timestamp by its date part, ignoring the time-of-day', () => {
    expect(airingLabel('2026-09-22T23:59:59Z', NOW, 0)?.label).toBe(
      'Airs today'
    )
  })
})
