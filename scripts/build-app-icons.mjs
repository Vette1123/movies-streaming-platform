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

import { mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

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
  const {
    buildIconInput,
    buildSplashInput,
    MASKABLE_GLYPH_SCALE,
    DEFAULT_RADIUS,
    APPLE_SPLASH,
  } = source

  // radius: only the targets the platform does NOT mask get rounded. The
  // maskable pair, the iOS icons and the Windows tile are clipped to the
  // platform's own shape, and rounding those twice shows as pale slivers in
  // the corners. Everything else — favicon, `purpose: "any"` manifest icons —
  // is drawn as-is, so it has to carry its own corners or it reads as a hard
  // square next to every other icon on the shelf.
  const TARGETS = [
    { file: 'android-chrome-192x192.png', size: 192, radius: DEFAULT_RADIUS },
    { file: 'android-chrome-512x512.png', size: 512, radius: DEFAULT_RADIUS },
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

  const renderPng = async ({ size, radius = 0, glyphScale }) => {
    const { jsx, options } = await buildIconInput({
      size,
      radius,
      glyphScale,
    })
    const raw = Buffer.from(await new ImageResponse(jsx, options).arrayBuffer())
    return optimizePng(raw)
  }

  for (const target of TARGETS) {
    const { buf, note } = await renderPng(target)
    await writeFile(join('public', target.file), buf)
    console.log(
      `✓ public/${target.file} (${target.size}px, ${buf.length}B, ${note})`
    )
  }

  // favicon.ico last, and as four renders rather than one.
  //
  // It used to hold a single 64px image and let the browser downscale. That is
  // the one size nothing displays: tabs draw 16px (32 at 2x), the bookmark bar
  // and Windows shortcuts draw 32 and 48. A generic downscale closes up the
  // counter of a 900-weight R and softens the corner radius. Drawing each size
  // at its own resolution takes the file from ~2.8KB to ~7.9KB, which is
  // nothing against the week of browser cache it now gets (public/_headers).
  //
  // The file lives in public/ and NOT app/favicon.ico on purpose: Turbopack's
  // metadata pipeline decodes app/favicon.ico and rejects anything that isn't
  // RGBA ("Processing image failed / The PNG is not in RGBA format!"), which
  // fails the whole page render, not just the icon. public/ is served
  // untouched. It has to exist as a real file because browsers and crawlers
  // request /favicon.ico unprompted, and the <link rel="icon"> in the document
  // is only read afterwards.
  const FAVICON_SIZES = [16, 32, 48, 64]
  const renders = []
  for (const size of FAVICON_SIZES) {
    renders.push(await renderPng({ size, radius: DEFAULT_RADIUS }))
  }
  const ico = pngsToIco(renders.map((r) => r.buf))
  await writeFile('public/favicon.ico', ico)
  console.log(
    `✓ public/favicon.ico (${FAVICON_SIZES.join('/')}px, ${ico.length}B)`
  )

  // iOS launch screens, one per device resolution per orientation. See
  // app/_icons/apple-splash.ts for why there is no way to do this with fewer
  // files. Mostly flat background, so they quantize to a few KB each.
  mkdirSync(join('public', 'splash'), { recursive: true })
  let splashBytes = 0
  for (const target of APPLE_SPLASH) {
    const { jsx, options } = await buildSplashInput(target)
    const raw = Buffer.from(await new ImageResponse(jsx, options).arrayBuffer())
    const { buf } = await optimizePng(raw)
    // target.file is the public-root href ("/splash/..."), so strip the slash.
    await writeFile(join('public', target.file.slice(1)), buf)
    splashBytes += buf.length
  }
  console.log(
    `✓ public/splash/ (${APPLE_SPLASH.length} launch screens, ${Math.round(splashBytes / 1024)}KB total)`
  )
} finally {
  rmSync(TMP, { recursive: true, force: true })
}

/**
 * Pack PNGs into a multi-image ICO container. Every browser since IE Vista
 * reads PNG-encoded ICO entries, so there is no need to re-encode to BMP.
 *
 * Layout: a 6-byte header, then one 16-byte directory entry per image, then
 * the image data. Each entry carries an absolute file offset, so the whole
 * directory has to be sized before the first offset can be written.
 */
function pngsToIco(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(pngs.length, 4) // image count

  let offset = header.length + pngs.length * 16
  const entries = pngs.map((png) => {
    const width = png.readUInt32BE(16)
    const height = png.readUInt32BE(20)
    if (width > 256 || height > 256) {
      throw new Error(`ICO entries cap at 256px, got ${width}x${height}`)
    }

    const entry = Buffer.alloc(16)
    // A 256px image is stored as 0 — the field is one byte.
    entry.writeUInt8(width === 256 ? 0 : width, 0)
    entry.writeUInt8(height === 256 ? 0 : height, 1)
    entry.writeUInt8(0, 2) // palette size (0 = not paletted)
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...pngs])
}
