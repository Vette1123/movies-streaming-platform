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

/**
 * The live sitemap index body, or null. A browser UA because the WAF
 * challenges anything else, and the CI pass (CI_HEADER in
 * scripts/cf-waf-setup.mjs) because GitHub runners sit on Azure.
 */
export async function liveSitemapXml() {
  /** @type {Record<string, string>} */
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0',
  }
  if (process.env.CI_WAF_BYPASS)
    headers['x-reely-ci'] = process.env.CI_WAF_BYPASS
  const res = await fetch(SITEMAP_URL, { headers }).catch(() => null)
  return res?.ok ? res.text() : null
}
