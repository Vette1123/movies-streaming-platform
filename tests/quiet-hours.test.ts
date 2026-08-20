import { describe, expect, it } from 'vitest'

import {
  DIGEST_GAP_MS,
  isQuiet,
  normaliseQuietHours,
  shouldRing,
} from '@/lib/push/quiet'

/**
 * Quiet hours are wrong for a fortnight before anybody notices, because the
 * symptom is a phone that DID buzz at 3am for one person in one timezone. None
 * of it can be checked in a browser, so all of it is pinned here.
 */
const at = (iso: string) => Date.parse(iso)

describe('normaliseQuietHours', () => {
  it('takes a whole-hour window and an offset', () => {
    expect(normaliseQuietHours({ from: 23, to: 8, tz: 120 })).toEqual({
      from: 23,
      to: 8,
      tz: 120,
    })
  })

  it('refuses a window that would silence the whole day', () => {
    // Far more likely to be a slider that slipped than a real intention —
    // somebody who wants no alerts turns alerts off.
    expect(normaliseQuietHours({ from: 9, to: 9, tz: 0 })).toBe(null)
  })

  it('refuses hours that are not hours', () => {
    for (const bad of [
      { from: -1, to: 8 },
      { from: 24, to: 8 },
      { from: 22.5, to: 8 },
      { from: '22', to: 8 },
      null,
      'quiet',
    ]) {
      expect(normaliseQuietHours(bad)).toBe(null)
    }
  })

  it('clamps a nonsense offset instead of trusting it', () => {
    expect(normaliseQuietHours({ from: 1, to: 2, tz: 99999 })?.tz).toBe(840)
    expect(normaliseQuietHours({ from: 1, to: 2, tz: 'x' })?.tz).toBe(0)
  })
})

describe('isQuiet', () => {
  const overnight = { from: 23, to: 8, tz: 0 }

  it('wraps past midnight rather than reading the window backwards', () => {
    // 23:00-08:00 is nine hours across midnight, not the fifteen between them.
    expect(isQuiet(overnight, at('2026-08-20T23:30:00Z'))).toBe(true)
    expect(isQuiet(overnight, at('2026-08-20T03:00:00Z'))).toBe(true)
    expect(isQuiet(overnight, at('2026-08-20T12:00:00Z'))).toBe(false)
  })

  it('is exclusive of the closing hour, so 08:00 rings', () => {
    expect(isQuiet(overnight, at('2026-08-20T07:59:00Z'))).toBe(true)
    expect(isQuiet(overnight, at('2026-08-20T08:00:00Z'))).toBe(false)
  })

  it('handles a daytime window without wrapping', () => {
    const daytime = { from: 9, to: 17, tz: 0 }
    expect(isQuiet(daytime, at('2026-08-20T12:00:00Z'))).toBe(true)
    expect(isQuiet(daytime, at('2026-08-20T20:00:00Z'))).toBe(false)
  })

  it('reads the clock in their zone, not the Worker s', () => {
    // 22:00 UTC is 03:00 the next day in Karachi (+5). Quiet there, not here.
    const karachi = { from: 23, to: 8, tz: 5 * 60 }
    expect(isQuiet(karachi, at('2026-08-20T22:00:00Z'))).toBe(true)
    expect(isQuiet({ ...karachi, tz: 0 }, at('2026-08-20T22:00:00Z'))).toBe(
      false
    )
  })

  it('is never quiet without a window', () => {
    expect(isQuiet(null, at('2026-08-20T03:00:00Z'))).toBe(false)
  })
})

describe('shouldRing', () => {
  const now = at('2026-08-20T12:00:00Z')

  it('rings by default', () => {
    expect(
      shouldRing({ quiet: null, digest: false, lastPushAt: null }, now)
    ).toBe(true)
  })

  it('does not ring inside the quiet window, digest or not', () => {
    const quiet = { from: 11, to: 13, tz: 0 }
    expect(shouldRing({ quiet, digest: false, lastPushAt: null }, now)).toBe(
      false
    )
  })

  it('rings once, then not again until the gap has passed', () => {
    const options = { quiet: null, digest: true, lastPushAt: now - 1000 }
    expect(shouldRing(options, now)).toBe(false)
    expect(
      shouldRing({ ...options, lastPushAt: now - DIGEST_GAP_MS }, now)
    ).toBe(true)
  })

  it('rings the first time even on a digest, having nothing to space out from', () => {
    expect(
      shouldRing({ quiet: null, digest: true, lastPushAt: null }, now)
    ).toBe(true)
  })
})
