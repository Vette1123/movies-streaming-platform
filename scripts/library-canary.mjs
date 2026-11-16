// Can the own-library media plane serve a film right now? Read-only; spends
// nothing, needs no token.
//
//   pnpm library:canary
//
// The library tier sits AHEAD of every provider walk: the player resolves
// `movie:<id>` against it first, and a hit plays from our own CDN with no
// provider, relay or worker carrying a byte. Nothing else pings it between
// ingests, so a deploy that dropped a catalog entry or broke the byte tree
// would be felt first by a person pressing play. This walks the two layers in
// the order a play does and names the first one that broke:
//
//   1. the catalog file answers and names at least one title
//   2. every catalogued title's master.m3u8 answers 200 + `#EXTM3U`, and one
//      segment off that manifest answers 200 with bytes
//
// `.github/workflows/library-canary.yml` runs it hourly and opens an issue
// when it fails. Exit 1 on failure, with the report on stdout either way.
//
// ponytail: the catalog path and the per-ingest slugs are the plane's only
// guard — they are committed in the player's wrangler.jsonc, so this script
// may name them too. The SITE's token route (/api/library/hls/<token>/…) is
// what ingest verifies; hls.js spends the workers.dev host directly.

import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const LIBRARY =
  process.env.LIBRARY_URL ?? 'https://reely-library.boogado66.workers.dev'
// Must equal the player's LIBRARY_CATALOG_PATH (wrangler.jsonc) — the file the
// player's libraryLookup reads. Committed there, so committed here too.
const CATALOG =
  process.env.LIBRARY_CATALOG_PATH ??
  'catalog-5ad31e8789b628619d21d86845225e.json'
// A current browser string, whatever a CDN might think of empty UAs.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36'

/**
 * The verdict. Unlike the provider canary (whose catalog moves underneath it),
 * every catalogued library title was put there on purpose: one broken title is
 * a real break, so all of them must pass.
 */
export function verdict(layers, titles) {
  const failedTitles = titles.filter((t) => !t.ok).length
  return {
    ok: layers.every((l) => l.ok) && failedTitles === 0,
    failedTitles,
  }
}

async function timed(fn) {
  const t0 = Date.now()
  try {
    return { ...(await fn()), ms: Date.now() - t0 }
  } catch (error) {
    return { ok: false, detail: String(error), ms: Date.now() - t0 }
  }
}

const signal = () => AbortSignal.timeout(60_000)

/** The first reference the manifest names that is not a comment. */
const firstRef = (manifest) =>
  manifest
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'))

async function checkCatalog() {
  const res = await fetch(`${LIBRARY}/${CATALOG}`, {
    headers: { 'user-agent': UA },
    signal: signal(),
  })
  if (!res.ok) {
    return { ok: false, detail: `catalog ${res.status}` }
  }
  const cat = await res.json().catch(() => null)
  const titles = Object.entries(cat?.titles ?? {})
  if (!titles.length) {
    return { ok: false, detail: 'catalog answers but names no titles' }
  }
  return { ok: true, detail: `${titles.length} titles`, titles }
}

/**
 * One title, the way hls.js spends it: master.m3u8 (a variant playlist may
 * sit between), then one real segment with bytes behind it.
 */
async function checkTitle(key, path) {
  const master = await fetch(`${LIBRARY}/${path}`, {
    headers: { 'user-agent': UA },
    signal: signal(),
  })
  const manifest = await master.text()
  if (master.status !== 200 || !manifest.startsWith('#EXTM3U')) {
    return { ok: false, detail: `${key}: manifest ${master.status}` }
  }
  // Walk at most one playlist level down: a muxed ffmpeg tree is master ->
  // variant -> .ts; a bare tree is master -> .ts.
  let ref = firstRef(manifest)
  for (let depth = 0; depth < 2 && /\.m3u8($|\?)/i.test(ref ?? ''); depth++) {
    const variant = await fetch(new URL(ref, `${LIBRARY}/${path}`).href, {
      headers: { 'user-agent': UA },
      signal: signal(),
    })
    if (variant.status !== 200) {
      return {
        ok: false,
        detail: `${key}: variant ${ref} -> ${variant.status}`,
      }
    }
    ref = firstRef(await variant.text())
  }
  if (!ref) {
    return { ok: false, detail: `${key}: manifest names no segments` }
  }
  const seg = await fetch(new URL(ref, `${LIBRARY}/${path}`).href, {
    headers: { 'user-agent': UA },
    signal: signal(),
  })
  const bytes = seg.ok ? (await seg.arrayBuffer()).byteLength : 0
  if (seg.status !== 200 || !bytes) {
    return {
      ok: false,
      detail: `${key}: segment ${seg.status}, ${bytes} bytes`,
    }
  }
  return { ok: true, detail: `${key}: manifest + ${bytes} bytes of segment` }
}

async function main() {
  const catalog = await timed(checkCatalog)
  const layers = [{ name: 'Library catalog', ...catalog }]
  // One at a time: the plane is one worker with no queue worth stampeding.
  const titles = []
  for (const [key, entry] of catalog.titles ?? []) {
    titles.push({
      name: key,
      ...(await timed(() => checkTitle(key, entry.path ?? ''))),
    })
  }
  const { ok, failedTitles } = verdict(layers, titles)

  const row = (r) =>
    `| ${r.ok ? 'pass' : '**FAIL**'} | ${r.name} | ${r.ms}ms | ${String(r.detail).replaceAll('|', '/').replaceAll('\n', ' ')} |`
  const report = [
    ok ? '## Library plane: serving' : '## Library plane: BROKEN',
    '',
    '| | Check | Time | Detail |',
    '|---|---|---|---|',
    ...layers.map(row),
    ...titles.map(row),
    '',
    `${failedTitles} of ${titles.length} titles failed; the run fails when any does.`,
    ok
      ? ''
      : `Re-probe by hand: \`curl -s "${LIBRARY}/${CATALOG}"\`, then a title's manifest under it. The ingest walk is scripts/library-ingest.mjs.`,
  ].join('\n')

  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
  }
  if (process.env.REPORT_FILE) fs.writeFileSync(process.env.REPORT_FILE, report)
  process.exit(ok ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main()
}
