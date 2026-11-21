// pnpm seo:submit   resubmit the live sitemap index and every child to Search
// Console and Bing Webmaster. Each deploy that changes URLs does this itself
// (scripts/cf-deploy.mjs), and so does `pnpm seo:daily`; this is the manual
// lever. Exits 1 on any failure.
import { liveSitemapXml, submitSitemapIndex } from './lib/submit-sitemaps.mjs'
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()
const xml = await liveSitemapXml()
if (!xml)
  console.warn(
    'seo-submit: live sitemap unreadable, submitting the index alone'
  )
const { gsc, bing } = await submitSitemapIndex(xml)
if (gsc === 'failed' || bing === 'failed') process.exit(1)
