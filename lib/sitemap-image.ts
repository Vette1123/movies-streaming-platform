import { getPosterImageURL } from '@/lib/utils'

/**
 * Next writes `images` into the sitemap as given, unescaped. A wsrv.nl URL
 * carries `&` between its options, and one bare `&` is invalid XML: Bing stopped
 * reading the file there and went from 15.0K URLs to 242.
 */
export const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export const sitemapImage = (path: string) =>
  xmlEscape(getPosterImageURL(path))
