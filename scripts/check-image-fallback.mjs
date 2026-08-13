// Self-check for the image CDN fallback chain (`pnpm images:check`).
//
// There is no test runner in this repo, and the fallback chain is exactly the
// kind of code that is only exercised when something is already on fire — the
// day ImageKit runs out of quota is a bad day to find out the fallback pins
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

const IMAGEKIT_HOST = 'https://ik.imagekit.io/test'
const dir = mkdtempSync(path.join(tmpdir(), 'reely-imgcheck-'))
const entry = path.join(dir, 'entry.ts')
const out = path.join(dir, 'bundle.mjs')

// Forward slashes: esbuild reads these as import specifiers, and a Windows
// backslash is an escape there.
const mod = (p) => path.resolve(p).replace(/\\/g, '/')

writeFileSync(
  entry,
  `export * from '${mod('lib/tmdbConfig.ts')}'
   export { default as loader, avifSrcSet } from '${mod('lib/image-loader.ts')}'`
)

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'warning',
  define: {
    'process.env.NEXT_PUBLIC_IMAGE_CACHE_HOST_URL':
      JSON.stringify(IMAGEKIT_HOST),
  },
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

const hero = `${IMAGEKIT_HOST}/tr:w-2560,q-82,f-auto,pr-true/original/abc.jpg`
const poster = `${IMAGEKIT_HOST}/tr:q-82,f-auto/w500/def.png`

check('ImageKit -> wsrv keeps the TMDB path', () => {
  const next = m.getNextImageFallback(hero)
  urls.add(next)
  assert.ok(next.includes('https://image.tmdb.org/t/p/original/abc.jpg'), next)
  assert.ok(next.startsWith('https://wsrv.nl/?url='), next)
})

check('wsrv URL never enlarges (&we) — the old blur bug', () => {
  assert.match(m.getNextImageFallback(hero), /&we(&|$)/)
  assert.match(m.getNextImageFallback(poster), /&we(&|$)/)
})

check('wsrv -> TMDB origin is the last stage', () => {
  const wsrv = m.getNextImageFallback(hero)
  const origin = m.getNextImageFallback(wsrv)
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
  const wsrv = m.getNextImageFallback(hero)
  const at640 = m.loader({ src: wsrv, width: 640, quality: 65 })
  urls.add(at640)
  assert.match(at640, /&w=640(&|$)/)
  assert.match(at640, /&q=65(&|$)/)
  // The whole point: two candidate widths must differ, or the srcset is a lie.
  assert.notEqual(at640, m.loader({ src: wsrv, width: 1200, quality: 65 }))
})

check('loader clamps a wsrv URL to the TMDB size segment', () => {
  const wsrv = m.getNextImageFallback(poster)
  const asked = m.loader({ src: wsrv, width: 3840, quality: 70 })
  urls.add(asked)
  assert.match(asked, /&w=500(&|$)/)
})

check('a rewritten wsrv URL is still walkable to the origin', () => {
  const at640 = m.loader({ src: m.getNextImageFallback(hero), width: 640 })
  assert.equal(
    m.getNextImageFallback(at640),
    'https://image.tmdb.org/t/p/original/abc.jpg'
  )
})

check('ImageKit rewrite is unchanged', () => {
  assert.equal(
    m.loader({ src: hero, width: 1200, quality: 65 }),
    `${IMAGEKIT_HOST}/tr:w-1200,q-65,f-auto,pr-true/original/abc.jpg`
  )
  assert.ok(m.avifSrcSet(hero, 65).includes('f-avif'))
  // wsrv has no AVIF saver, so nothing must offer one for it.
  assert.equal(m.avifSrcSet(m.getNextImageFallback(hero), 65), undefined)
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
  m.markPrimaryImageHostDown(m.getNextImageFallback(hero))
  m.markPrimaryImageHostDown('https://image.tmdb.org/t/p/w500/x.jpg')
  assert.equal(m.isPrimaryImageHostDown(), false)
  // Three distinct primary URLs — a host that is actually down.
  m.markPrimaryImageHostDown(poster)
  m.markPrimaryImageHostDown(IMAGEKIT_HOST + '/tr:q-82,f-auto/w500/ghi.png')
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
