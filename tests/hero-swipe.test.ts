import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { isSwipeClick, TAP_SLOP } from '@/lib/tap-slop'

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// Pressing the hero's title picked up a ghost of a link (links and images are
// natively draggable, and user-select: none does not stop it), the browser
// cancelled the pointer, and the slide never moved. The track now cancels
// native drag, so the title can be a link again: viewers click it.
describe('the home hero swipes from anywhere', () => {
  it('links the title and Watch Now, and nothing else', () => {
    const slide = read('components/header/hero-slide.tsx')
    expect(slide.match(/<MediaLink\b/g) ?? []).toHaveLength(2)
    expect(slide).toMatch(/<MediaLink[\s\S]{0,600}<HeroWordmark/)
    expect(slide).toMatch(/<MediaLink[\s\S]{0,800}Watch Now/)
  })

  it('swallows the click that ends a mouse swipe on a link', () => {
    const carousel = read('components/carousel.tsx')
    expect(carousel).toMatch(/onClickCapture=\{onStageClickCapture\}/)
  })

  it('tells a swipe-ending click from a tap', () => {
    const down = { x: 100, y: 100 }
    // A swipe: the cursor travelled with the track.
    expect(isSwipeClick(down, { x: 260, y: 104, detail: 1 })).toBe(true)
    // A tap with a little jitter.
    expect(isSwipeClick(down, { x: 105, y: 103, detail: 1 })).toBe(false)
    expect(isSwipeClick(down, { x: 100 + TAP_SLOP, y: 100, detail: 1 })).toBe(
      false
    )
    // Keyboard Enter, and the carousel's own el.click() for a touch tap.
    expect(isSwipeClick(down, { x: 0, y: 0, detail: 0 })).toBe(false)
    // No pointer went down on the stage.
    expect(isSwipeClick(null, { x: 0, y: 0, detail: 1 })).toBe(false)
  })

  it('cancels native drag on the track', () => {
    const carousel = read('components/carousel.tsx')
    expect(carousel).toMatch(
      /addEventListener\('dragstart'[\s\S]{0,80}preventDefault|preventDefault[\s\S]{0,80}addEventListener\('dragstart'/
    )
  })
})
