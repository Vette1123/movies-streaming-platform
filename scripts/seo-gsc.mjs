#!/usr/bin/env node
// seo-gsc: what Google Search shows of the site, and which queries are one push from clicks.
// Same script as social-media-downloader; auth reuses search-engines.mjs (the same service
// account as seo:daily, a Full user on sc-domain:reely.space).
//
//   pnpm seo:gsc                 last 28 days: totals, striking distance, unclicked pages
//   pnpm seo:gsc --days 90
//   pnpm seo:gsc --json
//
// LIMITS. Search Console data lags 2-3 days, and Google hides rare queries for privacy, so the
// query rows add up to less than the totals. Operator queries (-site:, intitle:) are scrapers
// and are dropped from the lists; the totals still count them.
import process from 'node:process'

import { flatten, seenNotClicked, strikingDistance } from './lib/gsc-rank.mjs'
import { BASE_URL as baseUrl } from './lib/indexnow.mjs'
import { googleAccessToken } from './lib/search-engines.mjs'
import { GSC_SITE } from './lib/submit-sitemaps.mjs'
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const args = process.argv.slice(2).filter((a) => a !== '--')
const bad = args.filter(
  (a, i) =>
    a.startsWith('--') &&
    !['--days', '--json'].includes(a) &&
    args[i - 1] !== '--days'
)
if (bad.length) {
  console.error(`unknown flag ${bad.join(', ')}; accepts --days <n>, --json`)
  process.exit(2)
}
const days = Number(
  args.includes('--days') ? args[args.indexOf('--days') + 1] : 28
)
if (!Number.isInteger(days) || days < 1 || days > 480)
  throw new Error(`--days must be 1-480, got ${days}`)
const json = args.includes('--json')

if (!process.env.GSC_SERVICE_ACCOUNT_JSON)
  throw new Error('GSC_SERVICE_ACCOUNT_JSON is not set (.env.local or env)')
const sa = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON)
const token = await googleAccessToken(sa)

const day = (offset) =>
  new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10)
const [startDate, endDate] = [day(days), day(1)]

// Google's per-request maximum. Totals are exact; a list that fills it is the top rows only.
const ROW_LIMIT = 1000

async function query(dimensions) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit: ROW_LIMIT,
      }),
    }
  )
  if (res.status === 403)
    throw new Error(
      `403 from Search Console: add ${sa.client_email} as a user on ${GSC_SITE} (Settings > Users and permissions).`
    )
  if (!res.ok)
    throw new Error(
      `Search Console ${res.status}: ${(await res.text()).slice(0, 300)}`
    )
  return (await res.json()).rows ?? []
}

const [totalsRows, queryRows, pageRows] = await Promise.all([
  query([]),
  query(['query']),
  query(['page']),
])
const total = totalsRows[0] ?? { clicks: 0, impressions: 0, position: 0 }
const queries = flatten(queryRows)
const pages = flatten(pageRows).map((r) => ({
  ...r,
  key: r.key.replace(baseUrl, '') || '/',
}))
const report = {
  window: { startDate, endDate },
  capped: [queryRows.length, pageRows.length].some((n) => n >= ROW_LIMIT),
  total: {
    clicks: total.clicks,
    impressions: total.impressions,
    position: Math.round(total.position * 10) / 10,
  },
  striking: strikingDistance(queries),
  unclickedPages: seenNotClicked(pages),
  topQueries: [...queries].sort((a, b) => b.impressions - a.impressions),
  pages,
}
if (report.total.impressions === 0)
  throw new Error(
    `0 impressions on ${GSC_SITE} from ${startDate} to ${endDate}: wrong property, not a quiet month.`
  )

if (json) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const row = (r) =>
    `  ${String(r.impressions).padStart(6)} imp  ${String(r.clicks).padStart(4)} clk  pos ${String(r.position).padStart(5)}  ${r.key}`
  console.log(`${GSC_SITE}  ${startDate} -> ${endDate} (data lags 2-3 days)`)
  console.log(
    `total: ${report.total.clicks} clicks, ${report.total.impressions} impressions, avg position ${report.total.position}`
  )
  if (report.capped)
    console.log(
      `lists capped at ${ROW_LIMIT} rows (Google's limit): top rows only; totals are exact`
    )
  console.log(`\ntop queries by impressions: ${queries.length}`)
  report.topQueries.slice(0, 20).forEach((r) => console.log(row(r)))
  console.log(
    `\nstriking distance (position 4-20, 5+ impressions): ${report.striking.length}`
  )
  report.striking.slice(0, 25).forEach((r) => console.log(row(r)))
  console.log(
    `\npages seen 20+ times with 0 clicks (title/description not answering): ${report.unclickedPages.length}`
  )
  report.unclickedPages.slice(0, 25).forEach((r) => console.log(row(r)))
  console.log(`\nall pages: ${pages.length}`)
  pages.slice(0, 40).forEach((r) => console.log(row(r)))
}
