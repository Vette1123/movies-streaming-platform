// Regenerate app/_fonts/inter-{700,900}.ts from Google Fonts.
//
// Why: the Cloudflare Worker that serves /opengraph-image kept hitting CPU
// limit 1102 because it was fetching Google Fonts on every render. We now
// bundle the exact glyph subsets at build time and decode them in-memory.
//
// Run: pnpm fonts:og  (whenever OG_INTER_GLYPHS_* in app/_fonts/load.ts change)

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONT_DIR = join(__dirname, '..', 'app', '_fonts')
const LOAD_PATH = join(FONT_DIR, 'load.ts')

// Intentionally no User-Agent header: Google Fonts serves TTF to UA-less
// requests, which is what Satori's prerender path supports. Modern browser UAs
// would get woff2, which Next 16's bundled Satori rejects with "Unsupported
// OpenType signature wOF2" during static generation.

function extractConstant(source, name) {
  const re = new RegExp(
    `export const ${name}\\s*=\\s*\\n?\\s*'([\\s\\S]*?)'`,
    'm'
  )
  const m = source.match(re)
  if (!m) throw new Error(`Could not find ${name} in load.ts`)
  return m[1]
}

async function fetchSubset(weight, text) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(text)}`
  const css = await fetch(cssUrl, {}).then((r) =>
    r.text()
  )
  const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)
  if (!match) throw new Error(`No font URL in CSS for weight ${weight}`)
  const buf = Buffer.from(
    await fetch(match[1], {}).then((r) =>
      r.arrayBuffer()
    )
  )
  return buf
}

async function main() {
  const loadSource = await readFile(LOAD_PATH, 'utf8')
  const glyphs900 = extractConstant(loadSource, 'OG_INTER_GLYPHS_900')
  const glyphs700 = extractConstant(loadSource, 'OG_INTER_GLYPHS_700')

  const [buf700, buf900] = await Promise.all([
    fetchSubset(700, glyphs700),
    fetchSubset(900, glyphs900),
  ])

  for (const [weight, buf] of [
    [700, buf700],
    [900, buf900],
  ]) {
    const target = join(FONT_DIR, `inter-${weight}.ts`)
    const constName = `INTER_${weight}_TTF_B64`
    const body = `export const ${constName} =\n  '${buf.toString('base64')}'\n`
    await writeFile(target, body, 'utf8')
    // eslint-disable-next-line no-console
    console.log(`inter-${weight}.ts: ${buf.length}B raw ttf`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
