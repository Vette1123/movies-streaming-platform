import { describe, expect, it } from 'vitest'

import { getMediaCrawlerImageUrl, toListEntries } from '@/lib/media'
import { apiConfig } from '@/lib/tmdbConfig'

// Google obeys robots.txt on an image's own host. wsrv.nl's ends with
// `User-agent: *` / `Disallow: /*?*`, and every wsrv URL is a query string, so
// Search Console flagged all 13,896 sitemap images (2026-11-22). Whatever a
// crawler reads bare (image sitemap, JSON-LD) must be a URL it may fetch.
const crawlable = (url: string | null | undefined) => {
  const u = new URL(url ?? '')
  return u.host === 'image.tmdb.org' && u.search === ''
}

describe('crawler-facing images', () => {
  it('crawlerImage is a TMDB origin URL with no query string', () => {
    const url = apiConfig.crawlerImage('/6pJB2t3MbQUy9m5pFIBHXLqnqNd.jpg')
    expect(url).toBe(
      'https://image.tmdb.org/t/p/w500/6pJB2t3MbQUy9m5pFIBHXLqnqNd.jpg'
    )
    expect(crawlable(url)).toBe(true)
  })

  it('a title JSON-LD image prefers the backdrop, falls back to the poster', () => {
    expect(getMediaCrawlerImageUrl('/b.jpg', '/p.jpg')).toBe(
      'https://image.tmdb.org/t/p/w1280/b.jpg'
    )
    expect(getMediaCrawlerImageUrl(null, '/p.jpg')).toBe(
      'https://image.tmdb.org/t/p/w500/p.jpg'
    )
    expect(getMediaCrawlerImageUrl(null, null)).toBeNull()
  })

  it('ItemList entries carry crawlable images', () => {
    const [entry] = toListEntries(
      [{ id: 550, title: 'Fight Club', poster_path: '/p.jpg' }],
      'movie'
    )
    expect(crawlable(entry.image)).toBe(true)
  })
})
