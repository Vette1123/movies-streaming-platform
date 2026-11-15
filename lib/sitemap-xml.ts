import type { MetadataRoute } from 'next'

// The sitemap's XML, written here rather than by Next's metadata route since
// /sitemap.xml became an index over several files (lib/sitemap-sections.ts).
//
// Every value is escaped, including image URLs: a wsrv.nl poster URL carries
// `&` between its options, and one bare `&` is invalid XML. Bing once stopped
// reading the file there and went from 15.0K URLs to 242.

export const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const tag = (name: string, value: string | number | undefined) =>
  value === undefined || value === ''
    ? ''
    : `<${name}>${xmlEscape(String(value))}</${name}>`

const lastmodOf = (value: string | Date | undefined) =>
  value instanceof Date ? value.toISOString() : value

export function renderUrlset(entries: MetadataRoute.Sitemap): string {
  const urls = entries.map(
    (entry) =>
      `<url>${tag('loc', entry.url)}${(entry.images ?? [])
        .map((image) => `<image:image>${tag('image:loc', image)}</image:image>`)
        .join('')}${tag('lastmod', lastmodOf(entry.lastModified))}${tag(
        'changefreq',
        entry.changeFrequency
      )}${tag('priority', entry.priority)}</url>`
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`
}

export function renderSitemapIndex(locs: string[], lastmod: string): string {
  const items = locs.map(
    (loc) => `<sitemap>${tag('loc', loc)}${tag('lastmod', lastmod)}</sitemap>`
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>\n`
}

export const xmlResponse = (body: string) =>
  new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
