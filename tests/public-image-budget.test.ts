import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MAX_BYTES = 100 * 1024
const RASTER = /\.(png|jpe?g|webp|avif|gif)$/i

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  )
}

describe('public/ images', () => {
  // Every byte here is served from our own origin on the free plan and has no
  // resize step in front of it, so a photo-sized file ships to every visitor.
  it(`keeps every raster under ${MAX_BYTES / 1024} KB`, () => {
    const big = walk('public')
      .filter((f) => RASTER.test(f))
      .map((f) => [f, statSync(f).size] as const)
      .filter(([, size]) => size > MAX_BYTES)
    expect(big).toEqual([])
  })

  // The Portfolio avatar in the command menu paints at ~32px; the 640px PNG
  // it replaced was 163 KB for it.
  it('serves the command-menu avatar as a small WebP', () => {
    expect(statSync('public/personal-logo.webp').size).toBeLessThan(10 * 1024)
    expect(readFileSync('components/command-menu.tsx', 'utf8')).toContain(
      '/personal-logo.webp'
    )
  })
})
