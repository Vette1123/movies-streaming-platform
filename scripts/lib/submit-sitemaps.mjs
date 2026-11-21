import { sitemapFeeds, submitSitemaps } from './search-engines.mjs'

export const GSC_SITE = 'sc-domain:reely.space'
// Bing verifies the apex; www pages submit under it (measured 2026-11-21).
export const BING_SITE = 'https://reely.space'

export const SITEMAP_URL = 'https://www.reely.space/sitemap.xml'

/**
 * Submits the sitemap index plus every child it lists (`xml`, the index body)
 * to GSC and Bing. A null body submits the index alone; Google expands it.
 */
export async function submitSitemapIndex(xml) {
  const feeds = sitemapFeeds(SITEMAP_URL, xml)
  const result = await submitSitemaps({
    feeds,
    gscSite: GSC_SITE,
    bingSite: BING_SITE,
  })
  console.log(
    `seo-submit: ${feeds.length} sitemaps, Search Console ${result.gsc}, Bing ${result.bing}`
  )
  return result
}
