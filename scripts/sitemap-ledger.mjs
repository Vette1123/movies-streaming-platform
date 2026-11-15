// pnpm sitemap:ledger — fold the live sitemap's title URLs into
// data/sitemap-ledger.json, which lib/sitemap-sections.ts keeps advertising forever.
// See scripts/lib/sitemap-ledger.mjs for why.
//
// Runs before every deploy build (so a URL listed for one six-hour window is
// carried into the next sitemap) and in the daily Ratings job, which commits
// the file so the floor survives a deploy that could not read the live site.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { liveSitemapUrls } from './lib/indexnow.mjs'
import { mergeLedger } from './lib/sitemap-ledger.mjs'

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'sitemap-ledger.json'
)
// One sitemap file holds 50,000 URLs. Movies and TV each have their own file
// (/sitemaps/movies.xml, /sitemaps/tv.xml), so each type is held to the limit
// on its own. Past 80%, split that type again in lib/sitemap-sections.ts.
const URL_LIMIT = 50_000

const urls = await liveSitemapUrls()
if (urls === null) {
  console.error('[sitemap-ledger] live sitemap unreadable; ledger unchanged')
  process.exit(1)
}
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
const full = ['movie', 'tv'].filter(
  (type) => (after[type]?.length ?? 0) > URL_LIMIT * 0.8
)
for (const type of full) {
  console.error(
    `[sitemap-ledger] ${after[type].length} ${type} titles is past 80% of the ${URL_LIMIT}-URL limit of one sitemap file: split that section in lib/sitemap-sections.ts`
  )
}
if (full.length) process.exit(1)
