import { describe, expect, it } from 'vitest'

import { stripIfDangling } from '../scripts/strip-map-comments.mjs'

// Prod chunks pointed at .map files the PostHog upload had already deleted, so
// DevTools logged a 404 per chunk. Only a comment whose map is missing may go.
const chunk = (tail: string) => `console.log(1)\n${tail}`

describe('stripIfDangling', () => {
  it('drops a comment whose map is gone', () => {
    const src = chunk('//# sourceMappingURL=a.js.map\n')
    expect(stripIfDangling(src, () => false)).toBe('console.log(1)\n')
  })

  it('keeps a comment whose map shipped (local build, no PostHog key)', () => {
    const src = chunk('//# sourceMappingURL=a.js.map')
    expect(stripIfDangling(src, () => true)).toBe(src)
  })

  it('leaves inline and absolute maps alone', () => {
    for (const url of ['data:application/json;base64,e30=', 'https://x/a.map'])
      expect(
        stripIfDangling(chunk(`//# sourceMappingURL=${url}`), () => false)
      ).toContain(url)
  })

  it('keeps the debug id PostHog matches on', () => {
    const src = chunk('//# debugId=abc\n//# sourceMappingURL=a.js.map')
    expect(stripIfDangling(src, () => false)).toBe(chunk('//# debugId=abc\n'))
  })

  it('is a no-op without a comment', () => {
    expect(stripIfDangling('x()', () => false)).toBe('x()')
  })
})
