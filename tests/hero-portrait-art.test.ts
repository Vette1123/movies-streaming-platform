import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

// React's automatic image preload skips anything inside <picture>, so moving the
// hero into one silently took the LCP image off the preload scanner's list.
describe('every hero that renders portrait art preloads it by hand', () => {
  for (const path of [
    'components/header/hero-slide.tsx',
    'components/header/hero-image.tsx',
  ]) {
    it(path, () => {
      const source = read(path)
      expect(source).toContain('portraitArt')
      expect(source).toMatch(/if \(priority\) preloadHeroImage\(/)
    })
  }
})
