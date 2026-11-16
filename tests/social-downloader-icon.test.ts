import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The drawer's Social Downloader row renders /apps/socialdownloader.webp. It is
// committed by hand (not made by `pnpm apps:icons`), so nothing else notices
// if it goes missing: the row would show a broken image.
describe('the Social Downloader icon', () => {
  const file = join(process.cwd(), 'public', 'apps', 'socialdownloader.webp')

  it('exists as a WebP', () => {
    expect(existsSync(file)).toBe(true)
    const head = readFileSync(file).subarray(0, 12).toString('latin1')
    expect(head.slice(0, 4)).toBe('RIFF')
    expect(head.slice(8, 12)).toBe('WEBP')
  })
})
