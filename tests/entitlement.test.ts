import { describe, expect, it } from 'vitest'

import {
  hasGrant,
  isEntitled,
  isProAt,
  paidThrough,
  PAST_DUE_GRACE_MS,
  withGrant,
  withoutGrant,
  type BillingRow,
} from '@/lib/billing/entitlement'

const NOW = Date.parse('2026-08-15T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

const row = (over: Partial<BillingRow>): BillingRow => ({
  sub_status: null,
  sub_ends_at: null,
  sub_past_due_since: null,
  ...over,
})

describe('hasGrant', () => {
  it('matches a whole name, never a substring', () => {
    expect(hasGrant({ grants: 'pro' }, 'pro')).toBe(true)
    expect(hasGrant({ grants: 'beta,pro' }, 'pro')).toBe(true)
    expect(hasGrant({ grants: ' pro , beta ' }, 'pro')).toBe(true)
    // The bug this exists to prevent: a future grant whose name contains "pro".
    expect(hasGrant({ grants: 'promo' }, 'pro')).toBe(false)
    expect(hasGrant({ grants: 'proximity,beta' }, 'pro')).toBe(false)
  })

  it('is false for every empty shape', () => {
    expect(hasGrant(null, 'pro')).toBe(false)
    expect(hasGrant({ grants: null }, 'pro')).toBe(false)
    expect(hasGrant({ grants: '' }, 'pro')).toBe(false)
  })
})

describe('withGrant / withoutGrant', () => {
  it('never clobbers another capability', () => {
    expect(withGrant('beta', 'pro')).toBe('beta,pro')
    expect(withoutGrant('beta,pro', 'pro')).toBe('beta')
  })

  it('is idempotent and de-duplicates', () => {
    expect(withGrant('pro', 'pro')).toBe('pro')
    expect(withGrant('pro,pro', 'pro')).toBe('pro')
  })

  it('collapses to null when the set empties', () => {
    expect(withoutGrant('pro', 'pro')).toBeNull()
    expect(withoutGrant(null, 'pro')).toBeNull()
  })
})

describe('paidThrough', () => {
  it('is exclusive at the boundary', () => {
    expect(paidThrough(NOW + 1, NOW)).toBe(true)
    expect(paidThrough(NOW, NOW)).toBe(false)
    expect(paidThrough(NOW - 1, NOW)).toBe(false)
    expect(paidThrough(null, NOW)).toBe(false)
  })
})

describe('isProAt', () => {
  it('entitles live subscriptions', () => {
    expect(isProAt(row({ sub_status: 'active' }), NOW)).toBe(true)
    expect(isProAt(row({ sub_status: 'trialing' }), NOW)).toBe(true)
  })

  it('keeps a cancelled subscription to the end of the paid period', () => {
    for (const status of ['canceled', 'scheduled_cancel']) {
      expect(
        isProAt(row({ sub_status: status, sub_ends_at: NOW + DAY }), NOW)
      ).toBe(true)
      expect(
        isProAt(row({ sub_status: status, sub_ends_at: NOW - DAY }), NOW)
      ).toBe(false)
      // No end date at all must fail closed, not grant forever.
      expect(isProAt(row({ sub_status: status }), NOW)).toBe(false)
    }
  })

  it('holds past_due open for the grace window and no longer', () => {
    const since = NOW - PAST_DUE_GRACE_MS + 1000
    expect(
      isProAt(row({ sub_status: 'past_due', sub_past_due_since: since }), NOW)
    ).toBe(true)
    expect(
      isProAt(
        row({
          sub_status: 'past_due',
          sub_past_due_since: NOW - PAST_DUE_GRACE_MS,
        }),
        NOW
      )
    ).toBe(false)
    // An unobserved transition has no window to measure.
    expect(isProAt(row({ sub_status: 'past_due' }), NOW)).toBe(false)
  })

  it('fails closed on every stopped or unknown status', () => {
    for (const status of ['expired', 'unpaid', 'paused', 'something_new', '']) {
      expect(isProAt(row({ sub_status: status }), NOW)).toBe(false)
    }
    expect(isProAt(null, NOW)).toBe(false)
  })
})

describe('isEntitled', () => {
  it('accepts a hand grant with no subscription at all', () => {
    expect(isEntitled(row({ grants: 'pro' }), NOW)).toBe(true)
  })

  it('accepts a subscription with no grant', () => {
    expect(isEntitled(row({ sub_status: 'active' }), NOW)).toBe(true)
  })

  it('refuses an account with neither', () => {
    expect(
      isEntitled(row({ grants: 'beta', sub_status: 'expired' }), NOW)
    ).toBe(false)
    expect(isEntitled(null, NOW)).toBe(false)
  })
})
