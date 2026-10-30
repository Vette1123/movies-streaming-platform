// Self-check for the image CDN fallback chain (`pnpm images:check`).
//
// There is no test runner in this repo, and the fallback chain is exactly the
// kind of code that is only exercised when something is already on fire — the
// day wsrv goes down is a bad day to find out the fallback pins
// every backdrop to an upscaled 2560px. So this asserts the URL shapes the
// chain produces, plus the loader's rewrite of them, without a browser.
//
// It bundles the real TS modules with esbuild (already a dependency, used by
// scripts/build-worker.mjs) rather than re-implementing anything: a check that
// copies the logic it is checking proves nothing.
//
// Add `--live` to also fetch each URL and print status/type/bytes.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const dir = mkdtempSync(path.join(tmpdir(), 'reely-imgcheck-'))
const entry = path.join(dir, 'entry.ts')
const out = path.join(dir, 'bundle.mjs')

// Forward slashes: esbuild reads these as import specifiers, and a Windows
// backslash is an escape there.
const mod = (p) => path.resolve(p).replace(/\\/g, '/')

writeFileSync(
  entry,
  `export * from '${mod('lib/tmdbConfig.ts')}'
   export { default as loader } from '${mod('lib/image-loader.ts')}'`
)

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'warning',
})

const m = await import(pathToFileURL(out).href)
rmSync(dir, { recursive: true, force: true })

const failures = []
const urls = new Set()
function check(name, fn) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures.push(name)
    console.log(`  FAIL ${name}\n       ${err.message.split('\n')[0]}`)
  }
}

const hero = m.apiConfig.originalImage('/abc.jpg')
const poster = m.apiConfig.w500Image('/def.png')
urls.add(hero)

check('the primary is wsrv and keeps the TMDB path', () => {
  assert.ok(hero.includes('https://image.tmdb.org/t/p/original/abc.jpg'), hero)
  assert.ok(hero.startsWith('https://wsrv.nl/?url='), hero)
})

check('wsrv URL never enlarges (&we) — the old blur bug', () => {
  assert.match(hero, /&we(&|$)/)
  assert.match(poster, /&we(&|$)/)
})

check('wsrv -> TMDB origin is the last stage', () => {
  const origin = m.getNextImageFallback(hero)
  urls.add(origin)
  assert.equal(origin, 'https://image.tmdb.org/t/p/original/abc.jpg')
  assert.equal(m.getNextImageFallback(origin), null)
})

check('foreign hosts are left alone', () => {
  assert.equal(
    m.getNextImageFallback('https://images.unsplash.com/x.jpg'),
    null
  )
  assert.equal(
    m.loader({ src: 'https://images.unsplash.com/x.jpg', width: 640 }),
    'https://images.unsplash.com/x.jpg'
  )
})

check('loader resizes a wsrv URL instead of passing it through', () => {
  const at640 = m.loader({ src: hero, width: 640, quality: 65 })
  urls.add(at640)
  assert.match(at640, /&w=640(&|$)/)
  assert.match(at640, /&q=65(&|$)/)
  assert.match(at640, /output=webp/)
  // The whole point: two candidate widths must differ, or the srcset is a lie.
  assert.notEqual(at640, m.loader({ src: hero, width: 1200, quality: 65 }))
})

check('loader clamps a wsrv URL to the TMDB size segment', () => {
  const asked = m.loader({ src: poster, width: 3840, quality: 70 })
  urls.add(asked)
  assert.match(asked, /&w=500(&|$)/)
})

check('a rewritten wsrv URL is still walkable to the origin', () => {
  assert.equal(
    m.getNextImageFallback(m.loader({ src: hero, width: 640 })),
    'https://image.tmdb.org/t/p/original/abc.jpg'
  )
})

check('circuit breaker needs 3 DISTINCT primary failures, not 1', () => {
  assert.equal(m.demoteFromPrimary(hero), hero)
  // One error — a missing poster, an aborted request, a content blocker — must
  // not trip it. Tripping on one moved 17 of 20 already-painted homepage images
  // off a working host, which is what "the images went blank" actually was.
  m.markPrimaryImageHostDown(hero)
  assert.equal(m.isPrimaryImageHostDown(), false)
  // The SAME url failing again is the same evidence, not new evidence.
  m.markPrimaryImageHostDown(hero)
  assert.equal(m.isPrimaryImageHostDown(), false)
  // A failure on a later stage says nothing about the primary.
  m.markPrimaryImageHostDown('https://image.tmdb.org/t/p/w500/x.jpg')
  assert.equal(m.isPrimaryImageHostDown(), false)
  // Three distinct primary URLs — a host that is actually down.
  m.markPrimaryImageHostDown(poster)
  m.markPrimaryImageHostDown(m.apiConfig.w500Image('/ghi.png'))
  assert.ok(m.isPrimaryImageHostDown())
  assert.equal(m.demoteFromPrimary(hero), m.getNextImageFallback(hero))
  // Already past stage 0 — must not rewind.
  const origin = 'https://image.tmdb.org/t/p/original/abc.jpg'
  assert.equal(m.demoteFromPrimary(origin), origin)
})

if (process.argv.includes('--live')) {
  console.log('\nlive probe (real files):')
  const real = [...urls].map((u) =>
    u
      .replace('/original/abc.jpg', '/original/pF0qkRsrHkdYadPWY9AMeFZfcwk.jpg')
      .replace('/w500/def.png', '/w500/2YkCVT6opPxKh2ogEqxVrCiFgsr.png')
  )
  for (const u of real) {
    const res = await fetch(u, {
      headers: { Accept: 'image/avif,image/webp,image/*,*/*' },
    })
    const bytes = (await res.arrayBuffer()).byteLength
    console.log(
      `  ${res.status} ${res.headers.get('content-type')} ${bytes}B  ${u}`
    )
    if (!res.ok) failures.push(`live ${u}`)
  }
}

console.log(failures.length ? `\n${failures.length} FAILED` : '\nall ok')
process.exit(failures.length ? 1 : 0)
