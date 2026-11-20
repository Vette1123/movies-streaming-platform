import fs from 'node:fs'
import { OG_GLYPHS } from '@/scripts/lib/og-glyphs.mjs'
import { describe, expect, it } from 'vitest'

import { SITE_CARD, SITE_CARD_ALT } from '@/lib/og/share-image'
import { OG_COPY } from '@/app/_og/source'

const words = [...Object.values(OG_COPY).flat(), SITE_CARD_ALT]

// The launch kit's one non-negotiable rule, applied to the most-shared copy
// the product has. Until 2026-11-20 the shipped og:image:alt still said
// "Watch movies & TV shows free … and stream" on every page.
const BANNED =
  /free (movies|to stream)|\bstream|no subscription|paywall|watch .* free/i

describe('the site share card', () => {
  it('says what Reely is, not a streaming pitch', () => {
    for (const text of words) expect(text).not.toMatch(BANNED)
  })

  it('only draws characters the bundled Inter subset has', () => {
    const missing = [...new Set(words.join(''))].filter(
      (ch) => !OG_GLYPHS.includes(ch)
    )
    expect(missing).toEqual([])
  })

  it('ships one alt text, size and type with every unfurl', () => {
    expect(SITE_CARD).toMatchObject({
      width: 1200,
      height: 630,
      alt: SITE_CARD_ALT,
    })
    const layout = fs.readFileSync('app/layout.tsx', 'utf8')
    expect(layout).not.toMatch(/alt: '/)
  })

  it('no page passes the bare card path, which drops the alt', () => {
    const pages = fs
      .readdirSync('app', { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !file.startsWith('_og'))
      .filter((file) =>
        /images: \[?'\/opengraph-image\.png'/.test(
          fs.readFileSync(`app/${file}`, 'utf8')
        )
      )
    expect(pages).toEqual([])
  })
})
