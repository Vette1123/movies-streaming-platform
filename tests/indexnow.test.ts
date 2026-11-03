import {
  changeReason,
  htmlRouteFor,
  mapLimit,
  pageFingerprint,
  sitemapUrls,
} from '@/scripts/lib/indexnow.mjs'
import { describe, expect, it } from 'vitest'

const page = (opts: { chunk?: string; title?: string; text?: string; ld?: string } = {}) =>
  `<html><head><meta charSet="utf-8"/><meta name="viewport" content="x"/>
<title>${opts.title ?? 'Dune'}</title><link rel="canonical" href="https://www.reely.space/movies/1"/>
<meta name="description" content="d"/>
<script type="application/ld+json">${opts.ld ?? '{"a":1}'}</script>
<script src="/_next/static/chunks/${opts.chunk ?? 'aaa'}.js"></script>
<style>.x{color:red}</style></head>
<body><div>${opts.text ?? 'Hello'}</div><script>self.__next_f.push("${opts.chunk ?? 'aaa'}")</script></body></html>`

describe('pageFingerprint', () => {
  it('ignores per-build chunk hashes and inline script payloads', () => {
    expect(pageFingerprint(page({ chunk: 'aaa' }))).toBe(
      pageFingerprint(page({ chunk: 'bbb' }))
    )
  })
  it.each([
    ['title', { title: 'Dune 2' }],
    ['visible text', { text: 'Goodbye' }],
    ['JSON-LD', { ld: '{"a":2}' }],
  ])('sees a changed %s', (_n, opts) => {
    expect(pageFingerprint(page(opts))).not.toBe(pageFingerprint(page()))
  })
})

describe('changeReason', () => {
  const url = 'https://www.reely.space/movies/1'
  const liveSitemap = new Set([url])
  it('new when absent from the live sitemap', () => {
    expect(changeReason({ url, liveSitemap: new Set(), built: null, live: null })).toBe('new')
  })
  it('skips an unprerendered page that is already live', () => {
    expect(changeReason({ url, liveSitemap, built: null, live: null })).toBeNull()
  })
  it('skips an identical page, flags a changed one', () => {
    expect(changeReason({ url, liveSitemap, built: page(), live: page({ chunk: 'z' }) })).toBeNull()
    expect(changeReason({ url, liveSitemap, built: page({ title: 'X' }), live: page() })).toBe('changed')
  })
  it('submits when the live page cannot be read', () => {
    expect(changeReason({ url, liveSitemap, built: page(), live: null })).toBe('live-unreadable')
  })
})

describe('helpers', () => {
  it('maps URLs to static-export files', () => {
    expect(htmlRouteFor('https://www.reely.space')).toBe('index.html')
    expect(htmlRouteFor('https://www.reely.space/movies/1')).toBe('movies/1.html')
    expect(htmlRouteFor('https://other.com/x')).toBeNull()
  })
  it('reads sitemap locs', () => {
    expect(sitemapUrls('<url><loc>https://a/</loc></url><loc> https://b </loc>')).toEqual(['https://a/', 'https://b'])
  })
  it('bounds concurrency', async () => {
    let live = 0
    let peak = 0
    await mapLimit(Array.from({ length: 30 }), 8, async () => {
      peak = Math.max(peak, ++live)
      await new Promise((r) => setTimeout(r, 2))
      live--
    })
    expect(peak).toBe(8)
  })
})

describe('noindex shells', () => {
  it('are never submitted, even when new', () => {
    const shell = '<html><head><title>Page Not Found</title><meta name="robots" content="noindex"/></head><body>x</body></html>'
    expect(
      changeReason({ url: 'https://www.reely.space/collection/9', liveSitemap: new Set(), built: shell, live: null })
    ).toBeNull()
  })
})
