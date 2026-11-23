// Runs after `next build` (scripts/build-cf.mjs): adds every title a baked page
// links to into out/sitemaps/{movies,tv}.xml. See scripts/lib/sitemap-linked.mjs.
//
// Skips titles TMDB has deleted (the ledger's `gone`) and taken-down titles
// (config/blocked-titles.json), the same two lib/sitemap-ledger.ts skips.
// The next deploy's `pnpm sitemap:ledger` folds these URLs into the ledger, so
// a title linked for one six-hour window stays listed after the link moves.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BASE_URL } from './lib/indexnow.mjs'
import { addLinkedTitles, linkedTitleIds } from './lib/sitemap-linked.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'out')
// One sitemap file may hold 50,000 URLs; scripts/sitemap-ledger.mjs warns at
// 80%. Over the hard limit Google rejects the whole file, so fail the build.
const URL_LIMIT = 50_000

const readJson = async (file) =>
  JSON.parse(await readFile(path.join(ROOT, file), 'utf8'))

const ledger = await readJson('data/sitemap-ledger.json')
const blocked = (await readJson('config/blocked-titles.json')).titles ?? []
const skip = {
  movie: new Set(ledger.gone?.movie ?? []),
  tv: new Set(ledger.gone?.tv ?? []),
}
for (const { type, id } of blocked) skip[type]?.add(id)
// Ledger titles are already listed, in /sitemaps/<type>-ledger-<n>.xml.
for (const type of ['movie', 'tv'])
  for (const id of ledger[type] ?? []) skip[type].add(id)

const linked = { movie: new Set(), tv: new Set() }
let pages = 0
for (const entry of await readdir(OUT, { recursive: true })) {
  if (!entry.endsWith('.html')) continue
  pages++
  const ids = linkedTitleIds(await readFile(path.join(OUT, entry), 'utf8'))
  for (const type of ['movie', 'tv'])
    for (const id of ids[type]) if (!skip[type].has(id)) linked[type].add(id)
}
if (pages < 500) {
  console.error(
    `[sitemap-linked] only ${pages} HTML files in out/; not a full export`
  )
  process.exit(1)
}

for (const [type, file, prefix] of [
  ['movie', 'sitemaps/movies.xml', '/movies'],
  ['tv', 'sitemaps/tv.xml', '/tv-shows'],
]) {
  const target = path.join(OUT, file)
  const { xml, added } = addLinkedTitles(
    await readFile(target, 'utf8'),
    linked[type],
    prefix,
    BASE_URL
  )
  const total = xml.match(/<loc>/g)?.length ?? 0
  if (total > URL_LIMIT) {
    console.error(
      `[sitemap-linked] ${file} would hold ${total} URLs, over the ${URL_LIMIT} limit; split it in lib/sitemap-sections.ts`
    )
    process.exit(1)
  }
  if (added) await writeFile(target, xml)
  console.log(
    `[sitemap-linked] ${file}: +${added} linked titles (${total} URLs, ${linked[type].size} linked from ${pages} pages)`
  )
}
