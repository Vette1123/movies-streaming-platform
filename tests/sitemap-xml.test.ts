import { describe, expect, it } from 'vitest'

import { SITEMAP_SECTIONS } from '@/lib/sitemap-sections'
import { renderSitemapIndex, renderUrlset, xmlEscape } from '@/lib/sitemap-xml'
import { getPosterImageURL } from '@/lib/utils'

import { expandSitemap } from '../scripts/lib/indexnow.mjs'

const BARE_AMP = /&(?!amp;|lt;|gt;|quot;|apos;)/

describe('sitemap XML', () => {
  it('escapes every XML special character', () => {
    expect(xmlEscape(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })

  it('leaves no bare ampersand, poster images included', () => {
    const xml = renderUrlset([
      {
        url: 'https://www.reely.space/movies/550',
        images: [getPosterImageURL('/6pJB2t3MbQUy9m5pFIBHXLqnqNd.jpg')],
        changeFrequency: 'monthly',
        priority: 0.7,
      },
    ])
    expect(xml).toContain('<image:loc>')
    expect(xml).toContain('&amp;')
    expect(xml).not.toMatch(BARE_AMP)
    expect(xml).toContain('<priority>0.7</priority>')
  })

  it('an index is read through to its children by the deploy scripts', async () => {
    const index = renderSitemapIndex(
      ['https://x/sitemaps/a.xml', 'https://x/sitemaps/b.xml'],
      '2026-11-15T00:00:00.000Z'
    )
    const files: Record<string, string> = {
      'https://x/sitemaps/a.xml': renderUrlset([{ url: 'https://x/1' }]),
      'https://x/sitemaps/b.xml': renderUrlset([{ url: 'https://x/2' }]),
    }
    await expect(
      expandSitemap(index, async (url: string) => files[url] ?? null)
    ).resolves.toEqual(['https://x/1', 'https://x/2'])
  })

  it('an unreadable child makes the whole set unreadable, not half of it', async () => {
    const index = renderSitemapIndex(['https://x/a.xml'], '2026-11-15')
    await expect(expandSitemap(index, async () => null)).resolves.toBeNull()
  })

  it('a flat urlset still reads (the live site before this deploy)', async () => {
    const flat = renderUrlset([{ url: 'https://x/1' }])
    await expect(expandSitemap(flat, async () => null)).resolves.toEqual([
      'https://x/1',
    ])
  })

  it('names the three sections the routes serve', () => {
    expect(Object.keys(SITEMAP_SECTIONS).sort()).toEqual([
      'core',
      'movies',
      'tv',
    ])
  })
})
