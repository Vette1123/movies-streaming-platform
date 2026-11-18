import { describe, expect, it } from 'vitest'

import {
  EAGER_PREFETCH_CARDS,
  isEagerCard,
  mediaLinkPrefetch,
} from '../hooks/use-prefetch-intent'

// A card link prefetches in the viewport only for the first row of a rail; the
// rest warm on intent (prefetch={false}). Viewport prefetch on all 100+ posters
// is what tripped the zone rate limit.
describe('eager prefetch of the first cards', () => {
  it('leaves the router default (viewport prefetch) on for eager links only', () => {
    expect(mediaLinkPrefetch(true)).toBeUndefined()
    expect(mediaLinkPrefetch(false)).toBe(false)
    expect(mediaLinkPrefetch(undefined)).toBe(false)
  })

  it('bounds the eager set to a first row', () => {
    expect(EAGER_PREFETCH_CARDS).toBe(6)
    expect(isEagerCard(0)).toBe(true)
    expect(isEagerCard(5)).toBe(true)
    expect(isEagerCard(6)).toBe(false)
    expect(isEagerCard(99)).toBe(false)
  })
})
