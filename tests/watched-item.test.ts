import { describe, expect, it } from 'vitest'

import { buildWatchedItem } from '@/hooks/use-local-storage'

// The stored shape is what the watchlist, the sync layer and every link out of
// them read. Getting `type` wrong sends a series to /movies/<id>.
describe('buildWatchedItem', () => {
  it('reads a raw TMDB series payload as a series', () => {
    const item = buildWatchedItem({ id: 95350, name: 'Lanterns' })
    expect(item.type).toBe('series')
    expect(item.title).toBe('Lanterns')
  })

  it('reads a raw TMDB movie payload as a movie', () => {
    const item = buildWatchedItem({ id: 1084244, title: 'Toy Story 5' })
    expect(item.type).toBe('movie')
  })

  it('is idempotent: building an already-built series keeps it a series', () => {
    // A built series stores its name in `title`, so a second pass that sniffed
    // the title alone turned it into a movie - which is what happened to every
    // series saved from the reels rail.
    const once = buildWatchedItem({ id: 95350, name: 'Lanterns' })
    const twice = buildWatchedItem(once)
    expect(twice.type).toBe('series')
    expect(twice.title).toBe('Lanterns')
  })

  it("ignores TMDB's own series `type` field", () => {
    // TMDB series details carry type: 'Scripted' | 'Miniseries' | ...
    const raw = { id: 1, name: 'Chernobyl', type: 'Miniseries' }
    expect(buildWatchedItem(raw).type).toBe('series')
  })
})
