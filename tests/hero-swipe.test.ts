import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// Pressing the hero's title picked up a ghost of a link (links and images are
// natively draggable, and user-select: none does not stop it), the browser
// cancelled the pointer, and the slide never moved. Only buttons click; a press
// anywhere else swipes.
describe('the home hero swipes from anywhere', () => {
  it('has one link in a slide: the Watch Now button', () => {
    const slide = read('components/header/hero-slide.tsx')
    expect(slide.match(/<MediaLink\b/g) ?? []).toHaveLength(1)
    expect(slide).toMatch(/<MediaLink[\s\S]{0,800}Watch Now/)
  })

  it('cancels native drag on the track', () => {
    const carousel = read('components/carousel.tsx')
    expect(carousel).toMatch(
      /addEventListener\('dragstart'[\s\S]{0,80}preventDefault|preventDefault[\s\S]{0,80}addEventListener\('dragstart'/
    )
  })
})
