import { describe, expect, it } from 'vitest'

import {
  accountTransitions,
  isPendingLive,
  PENDING_WINDOW_MS,
} from '@/lib/checkout'

const out = { signedIn: false, pro: false }
const free = { signedIn: true, pro: false }
const supporter = { signedIn: true, pro: true }

describe('accountTransitions', () => {
  it('reports nothing for a browser seen for the first time', () => {
    // Otherwise the deploy fires "activated" for every existing supporter.
    expect(accountTransitions(null, supporter)).toEqual({
      signedIn: false,
      activated: false,
    })
  })

  it('counts a sign-in', () => {
    expect(accountTransitions(out, free)).toEqual({
      signedIn: true,
      activated: false,
    })
  })

  it('counts the money landing on a free account', () => {
    expect(accountTransitions(free, supporter)).toEqual({
      signedIn: false,
      activated: true,
    })
  })

  it('counts paying first and signing in after', () => {
    expect(accountTransitions(out, supporter)).toEqual({
      signedIn: true,
      activated: true,
    })
  })

  it('does not re-count a supporter staying a supporter', () => {
    expect(accountTransitions(supporter, supporter)).toEqual({
      signedIn: false,
      activated: false,
    })
  })
})

describe('isPendingLive', () => {
  it('watches for two hours after checkout, then stops', () => {
    expect(isPendingLive(1000, 1000 + 60_000)).toBe(true)
    expect(isPendingLive(1000, 1000 + PENDING_WINDOW_MS)).toBe(false)
    expect(isPendingLive(1000, 500)).toBe(false)
  })
})
