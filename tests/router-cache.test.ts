import { describe, expect, it } from 'vitest'

// Every page is a static asset that only changes on deploy (~6h cadence), so the
// client router should keep what it has fetched. Next's defaults are 5 min for
// prefetched pages and 0 for a page reached without a prefetch, which is every
// card link here (they warm on intent, see hooks/use-prefetch-intent.ts): going
// back to a title you just left re-fetched its payload.
describe('client router cache', () => {
  it('keeps prefetched pages 30 min and un-prefetched ones 5 min', async () => {
    const { default: config } = await import('../next.config.mjs')
    const stale = config.experimental?.staleTimes
    expect(stale?.static).toBe(7200) // 2 h; under a day so an open tab picks up a deploy
    expect(stale?.dynamic).toBe(1800)
  })
})
