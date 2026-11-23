import { describe, expect, it } from 'vitest'

import {
  DAILY_PICKS,
  emptyLedger,
  isRequestable,
  picks,
  rankUrls,
  readInspection,
  toInspect,
} from '../scripts/lib/seo-pending.mjs'

const today = '2026-11-23'
const U = (n: number) => `https://www.example.com/p/${n}`

describe('toInspect', () => {
  it('skips URLs inspected recently, and re-inspects stale ones', () => {
    const ledger = emptyLedger()
    ledger.inspected[U(1)] = {
      date: '2026-11-01',
      indexed: true,
      state: 'Submitted and indexed',
    }
    ledger.inspected[U(2)] = {
      date: '2026-10-01',
      indexed: true,
      state: 'Submitted and indexed',
    }
    ledger.inspected[U(3)] = {
      date: '2026-11-22',
      indexed: false,
      state: 'Discovered - currently not indexed',
    }
    ledger.inspected[U(4)] = {
      date: '2026-11-19',
      indexed: false,
      state: 'Discovered - currently not indexed',
    }
    expect(
      toInspect([U(1), U(2), U(3), U(4), U(5)], ledger, today, 10)
    ).toEqual([U(2), U(4), U(5)])
  })

  it('skips URLs requested within the cooldown and honours the limit', () => {
    const ledger = emptyLedger()
    ledger.requested[U(1)] = '2026-11-20'
    expect(toInspect([U(1), U(2), U(3)], ledger, today, 1)).toEqual([U(2)])
  })
})

describe('picks', () => {
  it('offers only states a request can move, never twice in the cooldown, at most DAILY_PICKS', () => {
    const ledger = emptyLedger()
    const urls = Array.from({ length: 15 }, (_, i) => U(i))
    for (const url of urls) {
      ledger.inspected[url] = {
        date: today,
        indexed: false,
        state: 'Crawled - currently not indexed',
      }
    }
    ledger.inspected[U(0)].state = 'Page with redirect'
    ledger.requested[U(1)] = '2026-11-15'
    ledger.requested[U(2)] = '2026-11-01'
    const out = picks(urls, ledger, today).map((p: { url: string }) => p.url)
    expect(out).toHaveLength(DAILY_PICKS)
    expect(out).not.toContain(U(0))
    expect(out).not.toContain(U(1))
    expect(out[0]).toBe(U(2))
  })
})

describe('readInspection', () => {
  it('reads PASS as indexed and keeps the coverage state', () => {
    const json = {
      inspectionResult: {
        indexStatusResult: {
          verdict: 'PASS',
          coverageState: 'Submitted and indexed',
        },
      },
    }
    expect(readInspection(json)).toEqual({
      indexed: true,
      state: 'Submitted and indexed',
    })
    expect(readInspection({})).toEqual({ indexed: false, state: 'unknown' })
  })

  it('treats unknown, discovered and crawled as requestable, a canonical elsewhere as not', () => {
    expect(isRequestable('URL is unknown to Google')).toBe(true)
    expect(isRequestable('Discovered - currently not indexed')).toBe(true)
    expect(isRequestable('Alternate page with proper canonical tag')).toBe(
      false
    )
  })
})

describe('rankUrls', () => {
  it('puts top-level pages first, then preferred prefixes, each in sitemap order', () => {
    const urls = [
      'https://www.example.com/collection/10',
      'https://www.example.com/movies/5',
      'https://www.example.com/',
      'https://www.example.com/person/1',
      'https://www.example.com/tv-shows/7',
      'https://www.example.com/movies',
    ]
    expect(rankUrls(urls, ['/movies/', '/tv-shows/'])).toEqual([
      'https://www.example.com/',
      'https://www.example.com/movies',
      'https://www.example.com/movies/5',
      'https://www.example.com/tv-shows/7',
      'https://www.example.com/collection/10',
      'https://www.example.com/person/1',
    ])
  })
})
