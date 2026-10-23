// Copy each companion app's real launcher icon (lib/apps.ts) into
// public/apps/<slug>.webp, downscaled for a 40px slot at dpr 3.
//
// The menus used to show the same generic phone glyph beside every app, so
// the three rows were told apart only by reading. The icons live in the apps'
// own Expo projects (assets/images/icon.png), which sit beside this repo.
//
// Run: pnpm apps:icons [path-to-the-React-Native-folder]
//      default: ../../React Native (relative to the repo root)

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const SIZE = 120
const sourceRoot = resolve(process.argv[2] ?? '../../React Native')
const outDir = join('public', 'apps')

// The slugs come from lib/apps.ts itself, so a new app cannot be forgotten.
const slugs = [
  ...readFileSync('lib/apps.ts', 'utf8').matchAll(
    /companionApp\(\s*'([a-z0-9-]+)'/g
  ),
].map((m) => m[1])
if (!slugs.length) throw new Error('found 0 apps in lib/apps.ts')

mkdirSync(outDir, { recursive: true })
for (const slug of slugs) {
  const src = join(sourceRoot, slug, 'assets', 'images', 'icon.png')
  if (!existsSync(src)) throw new Error(`${slug}: no icon at ${src}`)
  const out = join(outDir, `${slug}.webp`)
  const info = await sharp(src)
    .resize(SIZE, SIZE)
    .webp({ quality: 88 })
    .toFile(out)
  console.log(`${slug}: ${src} -> ${out} (${info.size} bytes)`)
}
console.log(`wrote ${slugs.length} icons at ${SIZE}px`)
