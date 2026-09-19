import { describe, expect, it } from 'vitest'

import { canPage, railArrowState, roomInDirection } from '@/lib/rail-scroll'

/**
 * A rail arrow that is present, lit, and scrolls nothing is a dead click, and
 * PostHog logged those against the rails on the homepage. Every case below is
 * one where the three numbers look innocent and the old comparison got the
 * answer wrong.
 */
const rail = (
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number
) => ({
  scrollLeft,
  scrollWidth,
  clientWidth,
})

describe('railArrowState', () => {
  it('disables both arrows on a rail that has never been laid out', () => {
    // `content-visibility: auto` below the fold: all three read 0, and the
    // forward sum goes NEGATIVE. The old expression compared `0 < 0 - 0 - 1`,
    // which is false by luck rather than by intent; anything that shifted the
    // slack would have lit a right arrow over a rail with no cards rendered.
    expect(railArrowState(rail(0, 0, 0))).toEqual({
      canLeft: false,
      canRight: false,
    })
  })

  it('offers only forward at the start of a scrollable rail', () => {
    expect(railArrowState(rail(0, 3000, 800))).toEqual({
      canLeft: false,
      canRight: true,
    })
  })

  it('offers only back at the end', () => {
    expect(railArrowState(rail(2200, 3000, 800))).toEqual({
      canLeft: true,
      canRight: false,
    })
  })

  it('offers both in the middle', () => {
    expect(railArrowState(rail(900, 3000, 800))).toEqual({
      canLeft: true,
      canRight: true,
    })
  })

  it('treats a sub-pixel remainder at the end as no room', () => {
    // The case that produces the dead click in the wild: a rail scrolled fully
    // right reports a fraction, not an exact extreme.
    expect(railArrowState(rail(2199.6, 3000, 800)).canRight).toBe(false)
    expect(railArrowState(rail(0.4, 3000, 800)).canLeft).toBe(false)
  })

  it('disables both when the content fits', () => {
    expect(railArrowState(rail(0, 800, 800))).toEqual({
      canLeft: false,
      canRight: false,
    })
  })
})

describe('roomInDirection', () => {
  it('never reports negative travel', () => {
    // An un-laid-out rail, and a rail whose content shrank under a scrollLeft
    // the browser has not corrected yet. Callers ask "is there room"; less than
    // none is not an answer.
    expect(roomInDirection(1, rail(0, 0, 0))).toBe(0)
    expect(roomInDirection(1, rail(2000, 1000, 800))).toBe(0)
  })

  it('measures real travel each way', () => {
    expect(roomInDirection(1, rail(500, 3000, 800))).toBe(1700)
    expect(roomInDirection(-1, rail(500, 3000, 800))).toBe(500)
  })
})

describe('canPage', () => {
  it('refuses to page a rail with nothing left', () => {
    expect(canPage(1, rail(2200, 3000, 800))).toBe(false)
    expect(canPage(-1, rail(0, 3000, 800))).toBe(false)
    expect(canPage(1, rail(0, 0, 0))).toBe(false)
  })

  it('agrees with the arrow it belongs to', () => {
    // The press and the lit state must never disagree — that disagreement IS
    // the dead click.
    for (const metrics of [
      rail(0, 0, 0),
      rail(0, 3000, 800),
      rail(900, 3000, 800),
      rail(2200, 3000, 800),
      rail(0, 800, 800),
    ]) {
      const state = railArrowState(metrics)
      expect(canPage(1, metrics)).toBe(state.canRight)
      expect(canPage(-1, metrics)).toBe(state.canLeft)
    }
  })
})
