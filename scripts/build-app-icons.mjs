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
    SOFT_RADIUS,
    APPLE_SPLASH,
  } = source

  // radius: everything that is not drawn through a platform mask carries its
  // own corners.
  //
  // apple-touch-icon is on that list, which it was not at first. The reasoning
  // for leaving it square was that iOS clips it to a squircle anyway — true on
  // the home screen, and false everywhere else the file gets used. iOS falls
  // back to generating a launch screen from this icon when no
  // apple-touch-startup-image matches the device, and that generated screen
  // does NOT mask: a square icon on the splash is exactly the "still sharp"
  // report. Android's install fallback and link unfurlers don't mask it
  // either. DEFAULT_RADIUS is Apple's own squircle ratio, so on the surfaces
  // that DO mask, the rounding lands on the mask boundary rather than inside
  // it — no pale slivers, which was the other half of the original worry.
  //
  // Two different radii, because two different rules apply. The apple files
  // must match iOS's squircle exactly (see DEFAULT_RADIUS); the unmasked ones
  // are drawn as given, so they take the rounder SOFT_RADIUS that still reads
  // as rounded at favicon sizes.
  //
  // The maskable pair is rounded too, which sounds like it contradicts the
  // word 'maskable' and does not. Android maps a maskable icon onto the
  // 108dp adaptive-icon canvas and only ever DISPLAYS the central 72dp — the
  // outer ~16.7% of every edge is cropped by every launcher shape there is.
  // A SOFT_RADIUS corner cuts inward to about 0.58 of the half-diagonal,
  // while the widest mask (a rounded square) reaches ~0.43, so the rounding
  // lives entirely inside the band nothing draws. Nothing changes on a home
  // screen.
  //
  // What DOES change is the Android splash. Chrome composes its own launch
  // screen from the manifest and picks the MASKABLE icon for it, drawn raw —
  // no mask — so a square file is a hard square floating on black for the
  // whole launch, which is exactly what it looked like. Same radius as the
  // 'any' icons so the splash and the home-screen icon read as one mark.
  //
  // Still square: only the Windows tile (square by design).
  const TARGETS = [
    { file: 'android-chrome-192x192.png', size: 192, radius: SOFT_RADIUS },
    { file: 'android-chrome-512x512.png', size: 512, radius: SOFT_RADIUS },
    // Separate maskable files rather than one "any maskable" entry: a mark
    // sized to fill the frame loses its corners to Android's circular mask,
    // and a mark sized for the safe zone looks shrunken everywhere else.
    {
      file: 'android-chrome-192x192-maskable.png',
      size: 192,
      radius: SOFT_RADIUS,
      glyphScale: MASKABLE_GLYPH_SCALE,
    },
    {
      file: 'android-chrome-512x512-maskable.png',
      size: 512,
      radius: SOFT_RADIUS,
      glyphScale: MASKABLE_GLYPH_SCALE,
    },
    { file: 'apple-touch-icon.png', size: 180, radius: DEFAULT_RADIUS },
    // Ancient iOS looked for -precomposed to mean "don't add your own gloss".
    // Harmless to keep, and it is referenced by enough scrapers to be worth it.
    {
      file: 'apple-touch-icon-precomposed.png',
      size: 180,
      radius: DEFAULT_RADIUS,
    },
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
    renders.push(await renderPng({ size, radius: SOFT_RADIUS }))
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
