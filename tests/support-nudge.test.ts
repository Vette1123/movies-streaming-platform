import { describe, expect, it } from 'vitest'

import { shouldNudge } from '@/lib/support-nudge'

/**
 * The one place Reely asks for money without being asked first. Everything else
 * is a link somebody chooses to follow, so the rules here — once, never to a
 * supporter, and only after real use — are the ones worth pinning down.
 */
const at = (
  savedCount: number,
  extra: Partial<Parameters<typeof shouldNudge>[0]> = {}
) => shouldNudge({ savedCount, pro: false, alreadyNudged: false, ...extra })

describe('shouldNudge', () => {
  it('waits until the third save', () => {
    expect(at(1)).toBe(false)
    expect(at(2)).toBe(false)
    expect(at(3)).toBe(true)
  })

  it('never asks a supporter', () => {
    expect(at(3, { pro: true })).toBe(false)
  })

  it('asks once and never again', () => {
    expect(at(3, { alreadyNudged: true })).toBe(false)
  })

  it('does not re-ask somebody who is already past the threshold', () => {
    // The flag is what normally stops this, but a cleared browser has no flag
    // and can still have a long watchlist — a `>=` here would ask them on their
    // very next save.
    expect(at(4)).toBe(false)
    expect(at(40)).toBe(false)
  })

  it('ignores a watchlist that has gone backwards', () => {
    expect(at(0)).toBe(false)
    expect(at(-1)).toBe(false)
  })
})
