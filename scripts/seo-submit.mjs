// pnpm seo:submit   resubmit the live sitemap index and every child to Search
// Console and Bing Webmaster. Each deploy that changes URLs does this itself
// (scripts/cf-deploy.mjs); this is the manual lever. Exits 1 on any failure.
import { SITEMAP_URL, submitSitemapIndex } from './lib/submit-sitemaps.mjs'
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()
// A browser UA: the WAF challenges anything else.
const res = await fetch(SITEMAP_URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0',
  },
}).catch(() => null)
const xml = res?.ok ? await res.text() : null
if (!xml)
  console.warn(
    'seo-submit: live sitemap unreadable, submitting the index alone'
  )
const { gsc, bing } = await submitSitemapIndex(xml)
if (gsc === 'failed' || bing === 'failed') process.exit(1)
