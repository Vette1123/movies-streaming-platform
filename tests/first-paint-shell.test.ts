import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { RAIL_ENTRANCE_COUNT, railPosterInStaticHtml } from '@/lib/rail-scroll'

// React writes a Suspense boundary over 12.8KB out of line even when it has
// finished rendering, and Next does not expose that threshold. A loading.tsx
// wraps the whole page in such a boundary, so a static route that has one paints
// its skeleton first and hides its <h1> in a div that needs JavaScript to show.
// `pnpm seo:verify` asserts the same thing against production HTML.
const STATIC_ROUTES_WITH_REAL_CONTENT = [
  'app/(landing)',
  'app/movies/(movies-list)',
  'app/tv-shows/(tv-list)',
]

describe('first paint shell', () => {
  it.each(STATIC_ROUTES_WITH_REAL_CONTENT)(
    '%s has no route-level loading boundary',
    (route) => {
      expect(existsSync(`${route}/page.tsx`)).toBe(true)
      expect(existsSync(`${route}/loading.tsx`)).toBe(false)
    }
  )

  it('renders the homepage hero outside any Suspense boundary', () => {
    const page = readFileSync('app/(landing)/page.tsx', 'utf8')
    expect(page).toContain('<HeroSlider')
    expect(page).not.toMatch(/<Suspense\b/)
  })

  it('holds first paint until the whole hero is parsed', () => {
    const page = readFileSync('app/(landing)/page.tsx', 'utf8')
    expect(page).toContain('<link rel="expect" href="#first-screen-end"')
    expect(page.indexOf('</SectionErrorBoundary>')).toBeLessThan(
      page.indexOf('id="first-screen-end"')
    )
  })

  it('hydrates no homepage rail before the page has loaded', () => {
    const rails = readFileSync('components/main-page/intro-section.tsx', 'utf8')
    expect(rails).not.toMatch(/<List\b/)
    const island = readFileSync('components/main-page/lazy-rail.tsx', 'utf8')
    expect(island).toContain('onIdleAfterLoad')
  })

  it('renders only the first posters of a static rail', () => {
    expect(railPosterInStaticHtml(RAIL_ENTRANCE_COUNT - 1)).toBe(true)
    expect(railPosterInStaticHtml(RAIL_ENTRANCE_COUNT)).toBe(false)
  })

  it('never ships a poster under a CSS filter', () => {
    const source = readFileSync('components/blurred-image.tsx', 'utf8')
    expect(source).not.toMatch(/['" ]blur-(lg|md|sm|xl|0)\b/)
  })
})
