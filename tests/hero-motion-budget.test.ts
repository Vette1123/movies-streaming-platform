import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { magneticOffset } from '@/hooks/use-magnetic'

// A batch of "premium" motion shipped together on 2026-10-23 and pegged GPUs:
// 58 animations running at once on the homepage, a full-screen blur roaming
// forever, a rAF loop per hero button, and hero buttons dragged ~200px toward
// a far-away cursor. These pin the root causes, not the looks.

const css = readFileSync(
  new URL('../styles/globals.css', import.meta.url),
  'utf8'
)

/** The declarations of the first top-level rule whose selector is `selector`. */
const ruleBody = (selector: string) => {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `${selector} exists`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

// Full view showed a hairline across the middle of the trailer. The iframe was
// centred with translate(-50%) (a half pixel at odd sizes) and blown up 1.35x
// with `scale`, so Chrome composited a stretched iframe layer whose tile seam
// showed. It is now sized and placed in whole pixels, with no transform.
describe('the trailer iframe is laid out, not transformed', () => {
  it('has no scale or translate, and rounds its box to whole pixels', () => {
    const body = ruleBody('.hero-trailer-cover > iframe')
    expect(body).not.toMatch(/\bscale:|\btranslate:|transform:/)
    expect(body).toMatch(/round\(/)
  })
})

describe('magnetic hero buttons stay under the pointer', () => {
  const rect = { left: 100, top: 100, width: 40, height: 40 }

  it('never moves more than strength/2, however far the pointer is', () => {
    const far = magneticOffset(rect, { clientX: 5000, clientY: -5000 }, 8)
    expect(far).toEqual({ x: 4, y: -4 })
  })

  it('rests at the centre', () => {
    expect(magneticOffset(rect, { clientX: 120, clientY: 120 }, 8)).toEqual({
      x: 0,
      y: 0,
    })
  })
})

describe('nothing animates forever that nobody is looking at', () => {
  it('the poster border animates only while hovered', () => {
    expect(ruleBody('.card-gradient-border::before')).not.toMatch(/animation/)
  })

  it('the Watch pulse stops after a few breaths', () => {
    expect(ruleBody('.hero-pulse')).not.toMatch(/infinite/)
  })

  it('there is no roaming full-screen hero glow', () => {
    expect(css).not.toMatch(/\.hero-glow\b/)
  })

  it('the site-wide backdrop is still, on every device, with no blur', () => {
    // Measured at 46% GPU on an idle homepage while it roamed and twinkled.
    for (const selector of [
      '.site-aurora::before,\n.site-aurora::after',
      '.site-aurora::before',
      '.site-aurora::after',
      '.aurora-stars',
      '.aurora-stars--1',
      '.aurora-stars--2',
    ]) {
      const body = ruleBody(selector)
      expect(body, selector).not.toMatch(/animation|will-change|filter/)
    }
    expect(css).not.toMatch(/@keyframes (aurora-|stars-)/)
  })

  it('scroll reveal never hides content waiting for JS', () => {
    // The reveal is a scroll-driven animation inside @supports; there must be
    // no unconditional opacity:0 on the class.
    expect(css).not.toMatch(/\n\.reveal-base \{[^}]*opacity: 0/)
  })
})

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('per-element costs that multiply across a page', () => {
  it('cards are not permanently promoted to GPU layers', () => {
    expect(source('components/card.tsx')).not.toMatch(/'will-change-/)
  })

  it('only the first few cards of a rail animate in', () => {
    const list = source('components/list.tsx')
    expect(list).toMatch(/index < RAIL_ENTRANCE_COUNT &&\s+'animate-rise-in'/)
  })

  it('the rating count-up never re-renders React per frame', () => {
    expect(source('components/media/count-up-number.tsx')).not.toMatch(
      /useState/
    )
  })

  it('hero pills sit over video without a backdrop blur each', () => {
    expect(source('components/media/ratings-strip.tsx')).not.toMatch(
      /backdrop-blur-(sm|md|lg|xl|\[)/
    )
  })

  it('opaque chips and the card play badge carry no invisible blur', () => {
    expect(source('components/ui/chip.tsx')).not.toMatch(/backdrop-blur-/)
    expect(source('components/card.tsx')).not.toMatch(/backdrop-blur-/)
  })
})
