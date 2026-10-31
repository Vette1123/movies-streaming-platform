import { describe, expect, it } from 'vitest'

import { sitemapImage, xmlEscape } from '@/lib/sitemap-image'

describe('sitemap image URLs', () => {
  it('escapes every XML special character', () => {
    expect(xmlEscape(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })

  it('leaves no bare ampersand in a poster URL', () => {
    const url = sitemapImage('/6pJB2t3MbQUy9m5pFIBHXLqnqNd.jpg')
    expect(url).toContain('&amp;')
    expect(url).not.toMatch(/&(?!amp;)/)
  })
})
