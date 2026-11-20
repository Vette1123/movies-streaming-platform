// Regenerate app/_fonts/inter-{500,700,900}.ts from Google Fonts.
//
// Why: the Cloudflare Worker that served /opengraph-image kept hitting CPU
// limit 1102 because it fetched Google Fonts on every render. The cards are
// now rendered at build time from fonts bundled here, decoded in memory.
//
// Run: pnpm fonts:og  (whenever OG_GLYPHS or OG_FONT_WEIGHTS change)

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { OG_FONT_WEIGHTS, OG_GLYPHS } from './lib/og-glyphs.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONT_DIR = join(__dirname, '..', 'app', '_fonts')

// Intentionally no User-Agent header: Google Fonts serves TTF to UA-less
// requests, which is what Satori's prerender path supports. Modern browser UAs
// would get woff2, which Next 16's bundled Satori rejects with "Unsupported
// OpenType signature wOF2" during static generation.
async function fetchSubset(weight, text) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(text)}`
  const res = await fetch(cssUrl)
  if (!res.ok)
    throw new Error(`Google Fonts CSS ${res.status} for weight ${weight}`)
  const css = await res.text()
  const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)
  if (!match) throw new Error(`No font URL in CSS for weight ${weight}`)
  const font = await fetch(match[1])
  if (!font.ok) throw new Error(`Font file ${font.status} for weight ${weight}`)
  return Buffer.from(await font.arrayBuffer())
}

async function main() {
  for (const weight of OG_FONT_WEIGHTS) {
    const buf = await fetchSubset(weight, OG_GLYPHS)
    const target = join(FONT_DIR, `inter-${weight}.ts`)
    const body = `export const INTER_${weight}_TTF_B64 =\n  '${buf.toString('base64')}'\n`
    await writeFile(target, body, 'utf8')
    console.log(
      `inter-${weight}.ts: ${buf.length}B ttf, ${OG_GLYPHS.length} glyphs`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
