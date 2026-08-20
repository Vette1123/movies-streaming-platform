// Bundle cloudflare/worker.js for workerd.
//
// wrangler would bundle the entrypoint itself, but the Worker imports the app's
// own services (`@/services/discover`, `@/lib/fetch-client`, …) so that a filter
// result baked into a genre page at build time and one fetched at runtime come
// from identical code. Those imports use the `@/…` tsconfig path alias, which
// esbuild resolves from tsconfig.json and wrangler's own bundler does not.
//
// Output is a single ESM file with no external imports, which is exactly what
// `main` in wrangler.jsonc expects.

import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outfile = path.join(root, '.cloudflare', 'worker.mjs')

// CI puts the public config on the environment; locally it lives in .env.local,
// which Next loads for its own build but this plain node process does not. Load
// it so a local bundle inlines the same values CI does — otherwise the two
// builds differ in exactly the way that is hardest to notice.
try {
  process.loadEnvFile(path.join(root, '.env.local'))
} catch {
  // No .env.local (CI) — the environment already carries everything.
}

await rm(path.join(root, '.cloudflare'), { recursive: true, force: true })

// Stamped into the Worker's Cache API keys so a deploy cannot serve the
// previous build's HTML. Without it, fallback pages cached for s-maxage keep
// referencing `_next/static/chunks/*` hashes the new deploy deleted — the page
// then dies on a chunk load and bounces off the stale-deploy boundary until the
// entry expires. Observed locally across two builds; see cloudflare/worker.js.
const buildId = await readFile(path.join(root, '.next', 'BUILD_ID'), 'utf8')
  .then((id) => id.trim())
  .catch(() => 'dev')

// The same id goes into the exported service worker. `public/sw.js` ships a
// literal `__BUILD_ID__`; stamping it here is what makes /sw.js differ byte-wise
// between deploys, which is the only signal the browser accepts as "there is a
// new worker" — see the comment on CACHE in public/sw.js. Assert rather than
// silently skip: a missed substitution costs nothing at build time and leaves
// every installed PWA frozen on this build until it happens to navigate.
await (async () => {
  const swPath = path.join(root, 'out', 'sw.js')
  const source = await readFile(swPath, 'utf8').catch(() => null)
  if (source === null) {
    throw new Error(`sw.js missing from the export (${swPath})`)
  }
  if (!source.includes('__BUILD_ID__')) {
    // Already stamped with this build: re-running the bundler on an export that
    // next build didn't just overwrite. Anything else means the placeholder is
    // gone from public/sw.js and every installed PWA would freeze here.
    if (source.includes(buildId)) return
    throw new Error('sw.js has no __BUILD_ID__ placeholder left to stamp')
  }
  await writeFile(swPath, source.replaceAll('__BUILD_ID__', buildId))
})()

/**
 * Pre-split the exported fallback shells so the Worker never has to parse HTML.
 *
 * The tail-id fallback is ~70% of all Worker invocations, and it used to run a
 * 55 KB shell through HTMLRewriter on every cache miss: six selector handlers,
 * four of them only there to delete the shell's own generic <meta> tags. All of
 * that is the same work every time, on a file that only changes when we deploy —
 * so it belongs here, once per build, not there, once per request.
 *
 * The runtime is left with string concatenation between pre-encoded byte chunks.
 * It also drops an ASSETS subrequest per fallback, because the shell now travels
 * inside the bundle instead of being fetched.
 *
 * Emits, per shell, the four static pieces around the three dynamic insertions:
 *
 *   head … <title>│heading│</title> … │meta + JSON-LD│</head> … <body>│SEO div│…
 *
 * Every step asserts. A silently mis-split shell would serve a broken page for
 * every non-prerendered id, which is worse than a failed build by a wide margin;
 * if Next's output shape ever moves, this must stop the deploy, not survive it.
 */
async function shellTemplates() {
  const shells = {
    '/media-fallback.html': 'media-fallback.html',
    '/collection-fallback.html': 'collection-fallback.html',
    // The shared-list shell. Same treatment for the same reason: /l/<slug> is
    // assembled per request and has to unfurl like a real page.
    '/list-fallback.html': 'list-fallback.html',
    // Not a fallback: the real /lists page, decorated in place with the
    // directory's own links so a crawler sees them without running the fetch.
    '/lists.html': 'lists.html',
  }
  const templates = {}

  for (const [route, file] of Object.entries(shells)) {
    let html
    try {
      html = await readFile(path.join(root, 'out', file), 'utf8')
    } catch {
      // No export in out/ — this is a worker-only rebuild (`pnpm build:worker`).
      // The Worker keeps its HTMLRewriter path for exactly this case.
      console.log(`shell templates: out/${file} absent, using runtime rewrite`)
      return null
    }

    // Strip the shell's own metadata. HTMLRewriter used to do this per request
    // for one reason: it appends to <head>, so the generic site-level tags
    // survived AHEAD of the injected ones, and an unfurler reads the first
    // occurrence — every shared tail link showed "Reely — Movie & TV Show
    // Tracker" with the default OG image.
    const stripped = html
      .replace(/<meta[^>]+property="og:[^"]*"[^>]*>/g, '')
      .replace(/<meta[^>]+name="twitter:[^"]*"[^>]*>/g, '')
      .replace(/<meta[^>]+name="description"[^>]*>/g, '')
      .replace(/<link[^>]+rel="canonical"[^>]*>/g, '')
      // The robots meta especially. app/media-fallback/layout.tsx sets
      // `noindex, nofollow` so the bare /media-fallback URL stays out of the
      // index — correct for that URL, and catastrophic for the pages built
      // from it: the Worker serves this HTML as the REAL /movies/<id>, so
      // every detail page outside the prerendered set was telling Google not
      // to index it. That is Search Console's "Excluded by 'noindex' tag".
      // The static asset keeps its own tag; only the Worker's copy loses it,
      // and metaTags() puts `index, follow` back.
      .replace(/<meta[^>]+name="robots"[^>]*>/g, '')

    if (/property="og:|name="twitter:|name="robots"/.test(stripped)) {
      throw new Error(`${file}: og/twitter/robots tags survived the strip`)
    }

    const title = stripped.match(/<title>.*?<\/title>/s)
    const headEnd = stripped.indexOf('</head>')
    const bodyOpen = stripped.match(/<body[^>]*>/)
    if (!title || headEnd === -1 || !bodyOpen) {
      throw new Error(
        `${file}: expected <title>, </head> and <body> (title=${!!title} head=${headEnd !== -1} body=${!!bodyOpen})`
      )
    }

    const titleStart = title.index
    const titleEnd = titleStart + title[0].length
    const bodyEnd = bodyOpen.index + bodyOpen[0].length

    if (!(titleEnd <= headEnd && headEnd < bodyEnd)) {
      throw new Error(`${file}: <title>, </head>, <body> are out of order`)
    }

    templates[route] = {
      // …<title>
      beforeTitle: stripped.slice(0, titleStart) + '<title>',
      // </title>…(rest of head)
      afterTitle: '</title>' + stripped.slice(titleEnd, headEnd),
      // </head>…<body …>
      afterHead: stripped.slice(headEnd, bodyEnd),
      // (rest of document)
      afterBody: stripped.slice(bodyEnd),
    }
  }

  const bytes = JSON.stringify(templates).length
  console.log(
    `shell templates: ${Object.keys(templates).length} shells inlined (${(bytes / 1024).toFixed(1)} KiB raw)`
  )
  return templates
}

// The public config the shared services read off `process.env`.
//
// Next inlines every `process.env.NEXT_PUBLIC_*` textually when it builds the
// app — but esbuild builds this bundle, so the same reads stay live lookups
// here, against a workerd `process.env` that only carries what the Worker was
// given. Cloudflare holds the two TMDB secrets and nothing else, so without this
// NEXT_PUBLIC_TMDB_BASEURL is undefined at runtime and every /api/* call and
// tail page 500s. Inlining reproduces exactly what Next does for the app half.
//
// Only the NEXT_PUBLIC_ prefix, and only keys that are actually set: an unset
// key keeps its runtime lookup, so a `vars` entry in wrangler.jsonc can still
// supply it. Secrets are deliberately NOT inlined — they stay runtime reads
// fed by copyEnv() from the Worker's own secret store.
function publicEnvDefines() {
  const defines = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('NEXT_PUBLIC_') || value === undefined) continue
    defines[`process.env.${key}`] = JSON.stringify(value)
  }
  return defines
}

const result = await esbuild.build({
  entryPoints: [path.join(root, 'cloudflare', 'worker.js')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  // Resolves the `@/*` paths the shared services import by.
  tsconfig: path.join(root, 'tsconfig.json'),
  // workerd provides these; bundling Node's versions would break the build.
  external: ['node:*', 'cloudflare:*'],
  // `react` reaches the bundle through services/*.ts, which wrap their reads in
  // React's cache(). Outside a render that just calls through, so it is correct
  // here — it only needs to resolve.
  conditions: ['workerd', 'worker', 'browser', 'import'],
  mainFields: ['module', 'main'],
  define: {
    // Bundled for production; nothing here should take a dev-only branch.
    'process.env.NODE_ENV': '"production"',
    __BUILD_ID__: JSON.stringify(buildId),
    __SHELL_TEMPLATES__: JSON.stringify(await shellTemplates()),
    ...publicEnvDefines(),
  },
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  metafile: true,
})

const bytes = Object.values(result.metafile.outputs).reduce(
  (sum, output) => sum + output.bytes,
  0
)
console.log(
  `worker bundled: ${(bytes / 1024).toFixed(1)} KiB → ${outfile} (build ${buildId})`
)
