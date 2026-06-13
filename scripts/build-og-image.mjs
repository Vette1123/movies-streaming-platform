// Pre-render the OG image to public/opengraph-image.png.
//
// Why: serving /opengraph-image dynamically on Cloudflare Workers hit CPU
// limit 1102 intermittently (~50% 503s), even after bundling fonts. Satori
// rasterization is genuinely too expensive for the worker's per-request CPU
// budget. Shipping a pre-rendered PNG as a static asset means WhatsApp /
// Facebook / Twitter previews never touch the worker.
//
// Run: pnpm og:build  (after editing app/_og/source.tsx)

import esbuild from 'esbuild'
import { mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Build inside the project so the bundled `react` import resolves from
// node_modules. A tmpdir() path can't see the project's modules.
const TMP = join('node_modules', '.cache', 'reely-og-build')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
const bundlePath = join(TMP, 'source.mjs')

try {
  await esbuild.build({
    entryPoints: ['app/_og/source.tsx'],
    outfile: bundlePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    target: 'node22',
    external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  })

  const [{ buildOpenGraphImageInput }, { ImageResponse }] = await Promise.all([
    import(pathToFileURL(bundlePath).href),
    import('next/og.js'),
  ])

  const { jsx, options } = await buildOpenGraphImageInput()
  const response = new ImageResponse(jsx, options)
  const buf = Buffer.from(await response.arrayBuffer())
  await writeFile('public/opengraph-image.png', buf)
  console.log(`✓ public/opengraph-image.png (${buf.length}B)`)
} finally {
  rmSync(TMP, { recursive: true, force: true })
}
