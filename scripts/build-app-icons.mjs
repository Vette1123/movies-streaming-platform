// Pre-render the static icon files in public/ from the shared brand mark.
//
// Why this exists: site.webmanifest and browserconfig.xml point at plain PNGs
// that nothing in the build was generating. They had drifted into blank blue
// gradients with no "R" in them, so the Android install icon, the iOS home
// screen icon and both manifest shortcuts all rendered as empty squares, while
// the app/icon.tsx and app/apple-icon.tsx metadata routes rendered the real
// mark. Now every one of them comes out of app/_icons/source.tsx.
//
// Those two routes have since been deleted in favour of these files, for the
// same reason the OG image is static (see build-og-image.mjs): Satori
// rasterization is too expensive for the Worker's per-request CPU budget, and
// it was being paid on every cold request to render artwork that never
// changes. An install prompt whose icon 503s just shows no icon.
//
// Run: pnpm icons:build  (after editing app/_icons/source.tsx)

import esbuild from 'esbuild'
import { mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { optimizePng } from './optimize-png.mjs'

// Build inside the project so the bundled `react` import resolves from
// node_modules. A tmpdir() path can't see the project's modules.
const TMP = join('node_modules', '.cache', 'reely-icons-build')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
const bundlePath = join(TMP, 'source.mjs')

try {
  await esbuild.build({
    entryPoints: ['app/_icons/source.tsx'],
    outfile: bundlePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    target: 'node22',
    external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  })

  const [source, { ImageResponse }] = await Promise.all([
    import(pathToFileURL(bundlePath).href),
    import('next/og.js'),
  ])
  const { buildIconInput, MASKABLE_GLYPH_SCALE } = source

  // radius 0 everywhere below: every one of these targets is masked by the
  // platform (Android adaptive icon, iOS squircle, Windows tile), and rounding
  // twice shows as pale slivers in the corners.
  const TARGETS = [
    { file: 'android-chrome-192x192.png', size: 192 },
    { file: 'android-chrome-512x512.png', size: 512 },
    // Separate maskable files rather than one "any maskable" entry: a mark
    // sized to fill the frame loses its corners to Android's circular mask,
    // and a mark sized for the safe zone looks shrunken everywhere else.
    {
      file: 'android-chrome-192x192-maskable.png',
      size: 192,
      glyphScale: MASKABLE_GLYPH_SCALE,
    },
    {
      file: 'android-chrome-512x512-maskable.png',
      size: 512,
      glyphScale: MASKABLE_GLYPH_SCALE,
    },
    { file: 'apple-touch-icon.png', size: 180 },
    // Ancient iOS looked for -precomposed to mean "don't add your own gloss".
    // Harmless to keep, and it is referenced by enough scrapers to be worth it.
    { file: 'apple-touch-icon-precomposed.png', size: 180 },
    { file: 'mstile-150x150.png', size: 150 },
  ]

  const renderPng = async ({ size, glyphScale }) => {
    const { jsx, options } = await buildIconInput({ size, radius: 0, glyphScale })
    const raw = Buffer.from(await new ImageResponse(jsx, options).arrayBuffer())
    return optimizePng(raw)
  }

  for (const target of TARGETS) {
    const { buf, note } = await renderPng(target)
    await writeFile(join('public', target.file), buf)
    console.log(`✓ public/${target.file} (${target.size}px, ${buf.length}B, ${note})`)
  }

  // favicon.ico last, from a 64px render of the same mark.
  //
  // It lives in public/ and NOT app/favicon.ico on purpose: Turbopack's
  // metadata pipeline decodes app/favicon.ico and rejects anything that isn't
  // RGBA ("Processing image failed / The PNG is not in RGBA format!"), which
  // fails the whole page render, not just the icon. public/ is served
  // untouched. It has to exist as a real file because browsers and crawlers
  // request /favicon.ico unprompted, and the app/icon.tsx route only satisfies
  // the <link rel="icon"> they read afterwards.
  const { buf: png, note } = await renderPng({ size: 64 })
  const ico = pngToIco(png)
  await writeFile('public/favicon.ico', ico)
  console.log(`✓ public/favicon.ico (64px, ${ico.length}B, ${note})`)
} finally {
  rmSync(TMP, { recursive: true, force: true })
}

/**
 * Wrap a PNG in a single-image ICO container. Every browser since IE Vista
 * reads PNG-encoded ICO entries, so there is no need to re-encode to BMP.
 */
function pngToIco(png) {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (width > 256 || height > 256) {
    throw new Error(`ICO entries cap at 256px, got ${width}x${height}`)
  }

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(1, 4) // image count

  const entry = Buffer.alloc(16)
  // A 256px image is stored as 0 — the field is one byte.
  entry.writeUInt8(width === 256 ? 0 : width, 0)
  entry.writeUInt8(height === 256 ? 0 : height, 1)
  entry.writeUInt8(0, 2) // palette size (0 = not paletted)
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // colour planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(header.length + entry.length, 12) // pixel data offset

  return Buffer.concat([header, entry, png])
}
