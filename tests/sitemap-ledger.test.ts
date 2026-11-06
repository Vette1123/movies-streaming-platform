import { describe, expect, it } from 'vitest'

import { ledgerSitemapEntries } from '@/lib/sitemap-ledger'

import { detailIds, mergeLedger } from '../scripts/lib/sitemap-ledger.mjs'

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
    expect(merged).toEqual({ movie: [9, 550], tv: [1] })
  })

  it('drops a title taken down since it was listed', () => {
    const urls = ledgerSitemapEntries({ movie: [969681] }, new Set(), BASE)
    expect(urls).toEqual([])
  })

  it('reads ids as numbers', () => {
    expect([...detailIds([`${BASE}/tv-shows/330613`]).tv]).toEqual([330613])
  })
})
