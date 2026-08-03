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

import { readFile, rm } from 'node:fs/promises'
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
