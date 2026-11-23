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
import { markGone, mergeLedger, nextProbe } from './lib/sitemap-ledger.mjs'
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'sitemap-ledger.json'
)
// No size check here: the ledger is served in fixed-size shards
// (LEDGER_SHARDS in lib/sitemap-sections.ts), so it can grow without any one
// sitemap file nearing the 50,000-URL limit. Until 2026-11-23 this exited 1 at
// 80% of one file, which stopped the daily Ratings job and the ledger with it.

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
let after = mergeLedger(before, urls)

// --probe N: ask TMDB about the next N ledger ids of each type (a rotating
// cursor, so the daily job covers the whole ledger every few weeks) and move
// the ones TMDB answers 404 into `gone`. Only a 404 counts: a timeout, a 401
// or a 5xx keeps the id, so a TMDB outage can never empty the sitemap.
const probeAt = process.argv.indexOf('--probe')
const PROBE = probeAt === -1 ? 0 : Number(process.argv[probeAt + 1])
// More than this share of a slice gone means a broken base URL or key, not
// deleted titles (the 2026-11-16 baseline is well under 1%).
const MAX_GONE_SHARE = 0.2

async function tmdbGone(type, id) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_TMDB_BASEURL}${type}/${id}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_HEADER_KEY}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    }
  ).catch(() => null)
  return res?.status === 404
}

async function probe(type, ids) {
  const gone = []
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8)
    const hits = await Promise.all(batch.map((id) => tmdbGone(type, id)))
    batch.forEach((id, j) => hits[j] && gone.push(id))
  }
  return gone
}

if (PROBE > 0) {
  if (!process.env.NEXT_PUBLIC_TMDB_BASEURL || !process.env.TMDB_HEADER_KEY) {
    console.error(
      '[sitemap-ledger] --probe needs NEXT_PUBLIC_TMDB_BASEURL and TMDB_HEADER_KEY'
    )
    process.exit(1)
  }
  for (const type of ['movie', 'tv']) {
    const cursor = after.probe[type] % Math.max(after[type].length, 1)
    const ids = nextProbe(after[type], cursor, PROBE)
    const gone = await probe(type, ids)
    if (gone.length > ids.length * MAX_GONE_SHARE) {
      console.error(
        `[sitemap-ledger] ${gone.length} of ${ids.length} ${type} ids answered 404 — past ${MAX_GONE_SHARE * 100}%, so the TMDB config is suspect; nothing dropped`
      )
      process.exit(1)
    }
    after = markGone(after, type, gone)
    after.probe = {
      ...after.probe,
      [type]:
        (cursor + ids.length - gone.length) % Math.max(after[type].length, 1),
    }
    console.log(
      `[sitemap-ledger] probed ${ids.length} ${type} ids from #${cursor}; gone: ${gone.length ? gone.join(', ') : 'none'}`
    )
  }
}
const count = (l) => (l.movie?.length ?? 0) + (l.tv?.length ?? 0)
await writeFile(FILE, `${JSON.stringify(after)}\n`)
console.log(
  `[sitemap-ledger] ${urls.length} live URLs; ledger ${count(before)} → ${count(after)} titles`
)
