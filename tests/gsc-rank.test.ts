import { describe, expect, it } from 'vitest'

import {
  flatten,
  isScraper,
  seenNotClicked,
  strikingDistance,
} from '../scripts/lib/gsc-rank.mjs'

const rows = flatten([
  { keys: ['watch movies free'], clicks: 0, impressions: 15, position: 5.04 },
  { keys: ['reely movies'], clicks: 0, impressions: 65, position: 8.8 },
  { keys: ['reely'], clicks: 3, impressions: 15, position: 2.1 },
  { keys: ['tv series online'], clicks: 0, impressions: 4, position: 41.5 },
  {
    keys: ['-site:facebook.com "video downloader"'],
    clicks: 0,
    impressions: 13,
    position: 16.5,
  },
])

describe('gsc-rank', () => {
  it('drops operator queries as scrapers', () => {
    expect(isScraper('-site:facebook.com "x"')).toBe(true)
    expect(isScraper('intitle:downloader')).toBe(true)
    expect(isScraper('watch movies free')).toBe(false)
    expect(rows).toHaveLength(4)
  })

  it('keeps page 1-2 rows with impressions as striking distance, biggest first', () => {
    expect(strikingDistance(rows).map((r) => r.key)).toEqual([
      'reely movies',
      'watch movies free',
    ])
  })

  it('needs zero clicks and enough impressions for seen-not-clicked', () => {
    expect(seenNotClicked(rows).map((r) => r.key)).toEqual(['reely movies'])
    expect(rows[0].position).toBe(5)
  })
})
