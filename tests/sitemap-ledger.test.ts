import { describe, expect, it } from 'vitest'

import { ledgerSitemapEntries } from '@/lib/sitemap-ledger'

import {
  detailIds,
  markGone,
  mergeLedger,
  nextProbe,
} from '../scripts/lib/sitemap-ledger.mjs'

const BASE = 'https://www.reely.space'

// Bing, 2026-11-06: /tv-shows/321231 and /movies/1229031 were advertised by an
// earlier sitemap, then dropped when the TMDB lists moved.
describe('sitemap ledger', () => {
  it('keeps advertising a title the current lists no longer reach', () => {
    const ledger = mergeLedger({}, [
      `${BASE}/tv-shows/321231`,
      `${BASE}/movies/1229031`,
    ])
    const urls = ledgerSitemapEntries(ledger, new Set(), BASE).map((e) => e.url)
    expect(urls).toEqual([`${BASE}/movies/1229031`, `${BASE}/tv-shows/321231`])
  })

  it('never lists a URL twice', () => {
    const ledger = { movie: [550] }
    expect(
      ledgerSitemapEntries(ledger, new Set([`${BASE}/movies/550`]), BASE)
    ).toEqual([])
  })

  it('unions, never replaces, and ignores non-title URLs', () => {
    const merged = mergeLedger({ movie: [9], tv: [1] }, [
      `${BASE}/movies/550`,
      `${BASE}/movies/genre/action`,
      `${BASE}/person/287`,
      `${BASE}/collection/10`,
      `${BASE}/tv-shows/year/2026`,
    ])
    expect(merged).toMatchObject({ movie: [9, 550], tv: [1] })
  })

  it('drops a title taken down since it was listed', () => {
    const urls = ledgerSitemapEntries({ movie: [969681] }, new Set(), BASE)
    expect(urls).toEqual([])
  })

  it('reads ids as numbers', () => {
    expect([...detailIds([`${BASE}/tv-shows/330613`]).tv]).toEqual([330613])
  })
})

// GSC, 2026-11-16: /movies/1821659 was in the sitemap and answered 404 — TMDB
// had deleted it, and a ledger that only ever adds kept advertising it.
describe('titles TMDB has deleted', () => {
  it('stops listing a gone title', () => {
    const urls = ledgerSitemapEntries(
      { movie: [550, 1821659], gone: { movie: [1821659] } },
      new Set(),
      BASE
    ).map((e) => e.url)
    expect(urls).toEqual([`${BASE}/movies/550`])
  })

  it('never re-adds a gone title the live sitemap still lists', () => {
    const merged = mergeLedger(
      { movie: [550, 1821659], gone: { movie: [1821659] } },
      [`${BASE}/movies/1821659`, `${BASE}/movies/603`]
    )
    expect(merged.movie).toEqual([550, 603])
    expect(merged.gone).toEqual({ movie: [1821659], tv: [] })
  })

  it('markGone moves ids out of the list and into gone', () => {
    const next = markGone({ movie: [1, 2, 3], tv: [7] }, 'movie', [2])
    expect(next.movie).toEqual([1, 3])
    expect(next.gone).toEqual({ movie: [2], tv: [] })
    expect(next.tv).toEqual([7])
  })

  it('probes the next slice after the cursor and wraps', () => {
    expect(nextProbe([1, 2, 3, 4, 5], 0, 2)).toEqual([1, 2])
    expect(nextProbe([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4])
    expect(nextProbe([1, 2, 3, 4, 5], 4, 3)).toEqual([5, 1, 2])
    expect(nextProbe([1, 2, 3], 0, 10)).toEqual([1, 2, 3])
    expect(nextProbe([], 0, 10)).toEqual([])
  })
})
