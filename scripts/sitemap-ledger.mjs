// pnpm sitemap:ledger — fold the live sitemap's title URLs into
// data/sitemap-ledger.json, which app/sitemap.ts keeps advertising forever.
// See scripts/lib/sitemap-ledger.mjs for why.
//
// Runs before every deploy build (so a URL listed for one six-hour window is
// carried into the next sitemap) and in the daily Ratings job, which commits
// the file so the floor survives a deploy that could not read the live site.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BASE_URL, sitemapUrls } from './lib/indexnow.mjs'
import { mergeLedger } from './lib/sitemap-ledger.mjs'

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'sitemap-ledger.json'
)
// One sitemap file holds 50,000 URLs. Past this, split it (Next's
// generateSitemaps) instead of letting the build emit an invalid file.
const URL_LIMIT = 50_000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const res = await fetch(`${BASE_URL}/sitemap.xml`, {
  headers: { 'User-Agent': UA },
})
if (!res.ok) {
  console.error(
    `[sitemap-ledger] live sitemap → HTTP ${res.status}; ledger unchanged`
  )
  process.exit(1)
}
const urls = sitemapUrls(await res.text())
if (urls.length < 1000) {
  console.error(
    `[sitemap-ledger] live sitemap has only ${urls.length} URLs; refusing to trust it`
  )
  process.exit(1)
}

const before = JSON.parse(await readFile(FILE, 'utf8').catch(() => '{}'))
const after = mergeLedger(before, urls)
const count = (l) => (l.movie?.length ?? 0) + (l.tv?.length ?? 0)
await writeFile(FILE, `${JSON.stringify(after)}\n`)
console.log(
  `[sitemap-ledger] ${urls.length} live URLs; ledger ${count(before)} → ${count(after)} titles`
)
if (count(after) > URL_LIMIT * 0.8) {
  console.error(
    `[sitemap-ledger] ${count(after)} titles is past 80% of the ${URL_LIMIT}-URL sitemap limit: split app/sitemap.ts with generateSitemaps`
  )
  process.exit(1)
}
