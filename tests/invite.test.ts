import { describe, expect, it } from 'vitest'

import {
  MAX_REFERRAL_MONTHS,
  referralEarnsMonth,
  REFERRALS_PER_MONTH,
  referrerLookup,
} from '@/lib/billing/gifts'
import { mintInviteCode, parseInviteCode } from '@/lib/invite'
import { normaliseHandle } from '@/lib/profile/routes'

/**
 * Free accounts can earn a month by inviting people, so every rule here is one
 * that either credits the wrong person or prints free months.
 */
describe('invite codes', () => {
  it('mints a code that parses back to itself', () => {
    const code = mintInviteCode()
    expect(parseInviteCode(code)).toBe(code)
  })

  it('forgives case and stray whitespace from a pasted link', () => {
    const code = mintInviteCode(() => 0)
    expect(parseInviteCode(`  ${code.toUpperCase()} `)).toBe(code)
  })

  it('rejects anything that is not one', () => {
    expect(parseInviteCode('')).toBeNull()
    expect(parseInviteCode('inv_short')).toBeNull()
    expect(parseInviteCode('inv_0000000000')).toBeNull() // 0 is not in the alphabet
    expect(parseInviteCode('nope_aaaaaaaaaa')).toBeNull()
    expect(parseInviteCode(42)).toBeNull()
  })

  it('can never be mistaken for a public handle, nor a handle for a code', () => {
    // The cookie carries either; resolving one as the other would credit a stranger.
    expect(normaliseHandle(mintInviteCode())).toBeNull()
    expect(parseInviteCode('film-buff')).toBeNull()
  })
})

describe('referrerLookup', () => {
  it('resolves an invite code against invite_code', () => {
    const code = mintInviteCode()
    expect(referrerLookup(code)).toEqual({ column: 'invite_code', value: code })
  })

  it('resolves a public handle against handle, as before', () => {
    expect(referrerLookup('Film-Buff')).toEqual({
      column: 'handle',
      value: 'film-buff',
    })
  })

  it('resolves junk to nobody', () => {
    expect(referrerLookup(null)).toBeNull()
    expect(referrerLookup('x')).toBeNull()
  })
})

describe('referralEarnsMonth', () => {
  it('pays on every third sign-up', () => {
    expect(referralEarnsMonth(1)).toBe(false)
    expect(referralEarnsMonth(2)).toBe(false)
    expect(referralEarnsMonth(REFERRALS_PER_MONTH)).toBe(true)
    expect(referralEarnsMonth(REFERRALS_PER_MONTH * 2)).toBe(true)
  })

  it('stops paying once the lifetime cap is reached', () => {
    // Throwaway Google accounts are free; months must not be.
    expect(referralEarnsMonth(REFERRALS_PER_MONTH * MAX_REFERRAL_MONTHS)).toBe(
      true
    )
    expect(
      referralEarnsMonth(REFERRALS_PER_MONTH * (MAX_REFERRAL_MONTHS + 1))
    ).toBe(false)
  })
})
