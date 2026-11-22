// pnpm seo:daily   the daily search-engine run (.github/workflows/seo-daily.yml),
// ported from portfolio-v1's daily jobs:
//   1. resubmit the sitemap index and every child to Search Console and Bing;
//   2. Search Console: every child listed, read within SITEMAP_STALE_DAYS, no errors;
//   3. Bing: submission quota, crawl issues, a crawl counter jumping, the index dropping.
// Exits 1 on any problem, so the failed run mails the repo owner.
//
// ponytail: no URL Inspection report (portfolio's D1-backed IndexReport). The
// sitemap read covers the gap that bit us; add inspections if pages start
// dropping out of the index while their sitemap reads stay clean.
import {
  bingSummary,
  gscSitemapProblems,
  readBing,
  readGscSitemaps,
  sitemapFeeds,
} from './lib/search-engines.mjs'
import {
  BING_SITE,
  GSC_SITE,
  liveSitemapXml,
  SITEMAP_URL,
  submitSitemapIndex,
} from './lib/submit-sitemaps.mjs'
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()
const problems = []
const xml = await liveSitemapXml()
if (!xml) problems.push('live sitemap unreadable')
const feeds = sitemapFeeds(SITEMAP_URL, xml)

const submitted = await submitSitemapIndex(xml)
for (const [engine, state] of Object.entries(submitted))
  if (state !== 'ok' && state !== 'throttled')
    problems.push(`${engine} sitemap submit ${state}`)

if (process.env.GSC_SERVICE_ACCOUNT_JSON) {
  try {
    const list = await readGscSitemaps(
      JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON),
      GSC_SITE
    )
    for (const s of list)
      console.log(
        `gsc: ${s.path} read ${s.lastDownloaded ?? 'never'}, ${s.errors ?? 0} errors`
      )
    problems.push(...gscSitemapProblems(list, feeds).map((p) => `gsc: ${p}`))
  } catch (e) {
    problems.push(`gsc: ${e instanceof Error ? e.message : e}`)
  }
}

if (process.env.BING_API_KEY) {
  try {
    const summary = bingSummary(
      await readBing(process.env.BING_API_KEY, BING_SITE)
    )
    for (const l of summary.lines) console.log(`bing: ${l}`)
    problems.push(...summary.problems.map((p) => `bing: ${p}`))
  } catch (e) {
    problems.push(`bing: ${e instanceof Error ? e.message : e}`)
  }
}

for (const p of problems) console.log(`::error::seo-daily: ${p}`)
console.log(
  problems.length
    ? `seo:daily FAILED: ${problems.length} problems`
    : 'seo:daily OK'
)
process.exit(problems.length ? 1 : 0)
