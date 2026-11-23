// `pnpm seo:pending`: what Google has not indexed, and today's Request Indexing picks.
// Same script as social-media-downloader; only the three imports below differ.
//
//   pnpm seo:pending                      inspect the next 60 sitemap URLs, list not-indexed + picks
//   pnpm seo:pending --inspect 200        spend more of the URL Inspection quota this run
//   pnpm seo:pending --requested <url>…   log URLs you requested in Search Console
//
// Request Indexing itself has no API: work the picks in Search Console > URL inspection, then
// log them with --requested so they are not offered again for 14 days. Commit the ledger.
//
// LIMITS. The URL Inspection API allows 2,000 calls a day per property; each URL is one call,
// and the ledger skips URLs inspected recently (30 days if indexed, 3 if not). URLs are ranked
// by rankUrls: top-level pages, then title pages, then the rest, each in sitemap order.
// ponytail: a fixed rank, not traffic; feed GSC impressions in if the picks look random.
import { readFileSync, writeFileSync } from 'node:fs'

import { BASE_URL as baseUrl } from './lib/indexnow.mjs'
import { googleAccessToken, sitemapFeeds } from './lib/search-engines.mjs'
import {
  emptyLedger,
  notIndexed,
  picks,
  rankUrls,
  readInspection,
  toInspect,
} from './lib/seo-pending.mjs'
import { GSC_SITE } from './lib/submit-sitemaps.mjs'
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const LEDGER = 'scripts/seo-pending-ledger.json'
const today = new Date().toISOString().slice(0, 10)
const args = process.argv.slice(2)

const readLedger = () => {
  try {
    return { ...emptyLedger(), ...JSON.parse(readFileSync(LEDGER, 'utf8')) }
  } catch {
    return emptyLedger()
  }
}
// Sorted keys, so a day's run diffs as the URLs it touched and nothing else.
const sortKeys = (o) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
const writeLedger = (l) =>
  writeFileSync(
    LEDGER,
    `${JSON.stringify({ requested: sortKeys(l.requested), inspected: sortKeys(l.inspected) }, null, 2)}\n`
  )

const ledger = readLedger()

if (args[0] === '--requested') {
  const urls = args.slice(1)
  const bad = urls.filter((u) => !u.startsWith(`${baseUrl}/`) && u !== baseUrl)
  if (!urls.length || bad.length) {
    console.error(
      `seo:pending --requested: ${urls.length} URLs given, ${bad.length} not under ${baseUrl}: ${bad.join(' ')}`
    )
    process.exit(1)
  }
  for (const url of urls) ledger.requested[url] = today
  writeLedger(ledger)
  console.log(
    `seo:pending: logged ${urls.length} requested on ${today}; commit ${LEDGER}`
  )
  process.exit(0)
}

const inspectAt = args.indexOf('--inspect')
const limit = inspectAt >= 0 ? Number(args[inspectAt + 1]) : 60
if (!Number.isInteger(limit) || limit < 0 || limit > 2000) {
  console.error(
    `seo:pending: --inspect takes 0-2000, got ${args[inspectAt + 1]}`
  )
  process.exit(1)
}

async function sitemapUrls() {
  const root = `${baseUrl}/sitemap.xml`
  const rootXml = await (await fetch(root)).text()
  const feeds = sitemapFeeds(root, rootXml)
  const xmls =
    feeds.length === 1
      ? [rootXml]
      : await Promise.all(
          feeds.slice(1).map(async (f) => (await fetch(f)).text())
        )
  const urls = xmls.flatMap((xml) =>
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  )
  return [...new Set(urls)].filter((u) => !u.endsWith('.xml'))
}

// Title pages are what people search for; collection, person and genre pages wait.
const urls = rankUrls(await sitemapUrls(), ['/movies/', '/tv-shows/'])
if (!urls.length)
  throw new Error(`seo:pending: 0 URLs read from ${baseUrl}/sitemap.xml`)

if (!process.env.GSC_SERVICE_ACCOUNT_JSON)
  throw new Error('GSC_SERVICE_ACCOUNT_JSON is not set (.env.local or env)')
const token = await googleAccessToken(
  JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON)
)

const batch = toInspect(urls, ledger, today, limit)
let spent = 0
for (const url of batch) {
  const res = await fetch(
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_SITE }),
    }
  )
  if (res.status === 429) {
    console.log(
      `seo:pending: inspection quota reached after ${spent} calls; the rest waits for tomorrow`
    )
    break
  }
  if (!res.ok)
    throw new Error(
      `seo:pending: inspect ${url} -> ${res.status} ${(await res.text()).slice(0, 200)}`
    )
  ledger.inspected[url] = { date: today, ...readInspection(await res.json()) }
  spent++
}
writeLedger(ledger)

const known = urls.filter((u) => ledger.inspected[u])
const pending = notIndexed(urls, ledger)
const todays = picks(urls, ledger, today)
console.log(
  `seo:pending: ${urls.length} sitemap URLs, ${known.length} inspected (${spent} today), ${known.length - pending.length} indexed, ${pending.length} not`
)
const byState = Object.groupBy(pending, (p) => p.state)
for (const [state, rows] of Object.entries(byState))
  console.log(`  ${rows.length}  ${state}`)
console.log(
  `\nRequest Indexing today (${todays.length}), Search Console > URL inspection:`
)
for (const { url, state } of todays) console.log(`  ${url}  (${state})`)
if (todays.length)
  console.log(
    `\nthen: pnpm seo:pending --requested ${todays.map((t) => t.url).join(' ')}`
  )
