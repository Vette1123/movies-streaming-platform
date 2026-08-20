import { describe, expect, it } from 'vitest'

import {
  mintCode,
  normaliseCode,
  referralProgress,
  REFERRALS_PER_MONTH,
} from '@/lib/billing/gifts'
import { extendedEnd, MONTH_MS } from '@/lib/billing/months'

const NOW = Date.parse('2026-08-20T12:00:00Z')

/**
 * Months given away are entitlement, so every rule here is one somebody could
 * otherwise turn into free support forever, or lose time they were given.
 */
describe('extendedEnd', () => {
  it('adds to time already paid for rather than replacing it', () => {
    // Two codes on one account has to add up. Setting rather than extending
    // silently throws away whatever was left.
    const running = NOW + 10 * 24 * 60 * 60 * 1000
    expect(extendedEnd(running, 1, NOW)).toBe(running + MONTH_MS)
  })

  it('starts from now when nothing is running', () => {
    expect(extendedEnd(null, 1, NOW)).toBe(NOW + MONTH_MS)
  })

  it('starts from now when what was there has already lapsed', () => {
    // Extending from a date in the past would hand somebody a month that is
    // already over.
    expect(extendedEnd(NOW - MONTH_MS, 1, NOW)).toBe(NOW + MONTH_MS)
  })

  it('adds several months at once', () => {
    expect(extendedEnd(null, 3, NOW)).toBe(NOW + 3 * MONTH_MS)
  })
})

describe('normaliseCode', () => {
  it('forgives the way people type a code they are reading', () => {
    expect(normaliseCode('abcd-efgh-jk')).toBe('ABCDEFGHJK')
    expect(normaliseCode('  ABCD EFGH JK ')).toBe('ABCDEFGHJK')
  })

  it('refuses the letters the alphabet deliberately leaves out', () => {
    // No O, no I, no L, no 0/1 — the code has to survive being read aloud.
    expect(normaliseCode('ABCDEFGHIJ')).toBe(null)
    expect(normaliseCode('ABCDEFGH0K')).toBe(null)
  })

  it('refuses anything of the wrong length or type', () => {
    expect(normaliseCode('ABCDEFGH')).toBe(null)
    expect(normaliseCode('ABCDEFGHJKLM')).toBe(null)
    expect(normaliseCode(42)).toBe(null)
    expect(normaliseCode(null)).toBe(null)
  })
})

describe('mintCode', () => {
  it('only ever produces codes its own parser accepts', () => {
    // The mint and the parser are two lists of legal characters; if they ever
    // disagree, codes get handed out that can never be redeemed.
    for (let i = 0; i < 500; i++) {
      const code = mintCode()
      expect(normaliseCode(code)).toBe(code)
    }
  })

  it('is driven by the randomness it is given, so it can be pinned', () => {
    expect(mintCode(() => 0)).toBe('AAAAAAAAAA')
  })
})

describe('referralProgress', () => {
  it('counts a month per threshold reached', () => {
    expect(referralProgress(0).earned).toBe(0)
    expect(referralProgress(REFERRALS_PER_MONTH).earned).toBe(1)
    expect(referralProgress(REFERRALS_PER_MONTH * 2 + 1).earned).toBe(2)
  })

  it('counts down to the next one, never to zero', () => {
    // "0 more to go" is a lie on a counter that has already paid out.
    expect(referralProgress(0).toNext).toBe(REFERRALS_PER_MONTH)
    expect(referralProgress(REFERRALS_PER_MONTH).toNext).toBe(
      REFERRALS_PER_MONTH
    )
    expect(referralProgress(1).toNext).toBe(REFERRALS_PER_MONTH - 1)
  })
})
