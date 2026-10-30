import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { shareImageOf } from '@/lib/og/share-image'

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(file)
    return /\.tsx?$/.test(entry.name) ? [file] : []
  })

// Next replaces a parent's `openGraph` instead of merging it, so a route that
// declares its own title silently loses the site image and unfurls bare.
describe('share previews', () => {
  it('gives every route that sets openGraph its own image', () => {
    const bare = [...sourceFiles('app'), ...sourceFiles('components/media')]
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf8')
        return /openGraph: \{/.test(source) && !/\bimages\b/.test(source)
      })
      .map((file) => file.replaceAll('\\', '/'))
    expect(bare).toEqual([])
  })

  it('falls back to the site card on a page with no artwork', () => {
    const page = 'https://www.reely.space/lists'
    const card = 'https://www.reely.space/opengraph-image.png'
    expect(shareImageOf('', page)).toBe(card)
    expect(shareImageOf(null, page)).toBe(card)
    expect(shareImageOf('https://x.test/a.png', page)).toBe(
      'https://x.test/a.png'
    )
  })
})
