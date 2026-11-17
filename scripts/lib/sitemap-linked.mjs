// Every title a baked page links to belongs in the sitemap.
//
// lib/sitemap-sections.ts lists the prerendered titles and the rails of their
// detail pages. It did not list what the person, franchise, genre and year
// hubs link to: on 2026-11-17 those pages linked 3,638 titles no sitemap
// listed, and Bing reported the ones it crawled as "important pages missing in
// sitemaps". Reading the exported HTML instead of re-deriving each hub's
// lists means the sitemap cannot drift from what the pages actually link.

const TITLE_LINK =
  /href="(?:https?:\/\/[^/"]+)?\/(movies|tv-shows)\/(\d+)(?=["?#])/g
const TYPE = { movies: 'movie', 'tv-shows': 'tv' }

/** `{ movie: Set<number>, tv: Set<number> }` — the title ids `html` links to. */
export function linkedTitleIds(html) {
  const ids = { movie: new Set(), tv: new Set() }
  for (const [, section, id] of html.matchAll(TITLE_LINK))
    ids[TYPE[section]].add(Number(id))
  return ids
}

/**
 * `xml` (one <urlset>) with a <url> appended for every id in `ids` it does not
 * already list. Same priority as the ledger's tail ring.
 */
export function addLinkedTitles(xml, ids, pathPrefix, baseUrl) {
  const end = xml.lastIndexOf('</urlset>')
  if (end === -1) throw new Error('sitemap-linked: not a <urlset> file')
  const listed = new Set(
    Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1])
  )
  const urls = [...ids]
    .sort((a, b) => a - b)
    .map((id) => `${baseUrl}${pathPrefix}/${id}`)
    .filter((url) => !listed.has(url))
  if (!urls.length) return { xml, added: 0 }
  const entries = urls.map(
    (url) =>
      `<url><loc>${url}</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>\n`
  )
  return {
    xml: `${xml.slice(0, end)}${entries.join('')}${xml.slice(end)}`,
    added: urls.length,
  }
}
