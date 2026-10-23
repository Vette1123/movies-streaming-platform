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

  it('phones get the aurora and stars still, not animating', () => {
    const phone = css
      .split('@media (hover: none)')
      .slice(1)
      .map((block) => block.slice(0, block.indexOf('\n}\n')))
      .filter((block) => /site-aurora|aurora-stars/.test(block))
    expect(phone.length).toBeGreaterThan(0)
    for (const block of phone) expect(block).toMatch(/animation: none/)
  })

  it('scroll reveal never hides content waiting for JS', () => {
    // The reveal is a scroll-driven animation inside @supports; there must be
    // no unconditional opacity:0 on the class.
    expect(css).not.toMatch(/\n\.reveal-base \{[^}]*opacity: 0/)
  })
})
