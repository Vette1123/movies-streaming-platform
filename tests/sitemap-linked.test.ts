import { describe, expect, it } from 'vitest'

import {
  addLinkedTitles,
  linkedTitleIds,
} from '../scripts/lib/sitemap-linked.mjs'

const BASE = 'https://www.reely.space'

const urlset = (...locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs
    .map((loc) => `<url><loc>${loc}</loc></url>`)
    .join('\n')}\n</urlset>\n`

// Bing, 2026-11-17: 11 titles "missing in sitemaps". Person, franchise, genre
// and year pages linked 3,638 titles no sitemap listed.
describe('sitemap: titles the baked pages link to', () => {
  it('reads relative and absolute title links, and nothing else', () => {
    const html = `
      <a href="/movies/1811136">a</a>
      <a href="${BASE}/tv-shows/340544">b</a>
      <a href="/movies/550/watch">c</a>
      <a href="/movies/genre/drama">d</a>
      <a href="/person/287">e</a>
      <a href="/movies/1811136">again</a>`
    expect(linkedTitleIds(html)).toEqual({
      movie: new Set([1811136]),
      tv: new Set([340544]),
    })
  })

  it('appends the linked titles the sitemap misses, once each', () => {
    const xml = urlset(`${BASE}/movies/550`)
    const { xml: out, added } = addLinkedTitles(
      xml,
      new Set([550, 1811136, 1746103]),
      '/movies',
      BASE
    )
    expect(added).toBe(2)
    expect(out.match(/<loc>/g)).toHaveLength(3)
    expect(out).toContain(`<loc>${BASE}/movies/1746103</loc>`)
    expect(out.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('leaves the file alone when nothing is missing', () => {
    const xml = urlset(`${BASE}/movies/550`)
    expect(addLinkedTitles(xml, new Set([550]), '/movies', BASE)).toEqual({
      xml,
      added: 0,
    })
  })

  it('throws on a file that is not a urlset', () => {
    expect(() =>
      addLinkedTitles('<html></html>', new Set([1]), '/movies', BASE)
    ).toThrow(/urlset/)
  })
})
