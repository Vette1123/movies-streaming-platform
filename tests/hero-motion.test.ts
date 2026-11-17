import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { cardExit, kenBurnsClass } from '@/lib/hero-motion'

describe('kenBurnsClass', () => {
  it('runs the zoom on the active slide', () => {
    expect(kenBurnsClass(true, false)).toBe(
      'animate-hero-kenburns motion-reduce:animate-none'
    )
  })

  // Without the class an off-slide sat at scale 1, so a swipe jumped to 1.05
  // on release and the leaving slide fell back to 1 in view (17 Nov).
  it('keeps the zoom on a neighbour, paused, so a swipe does not jump', () => {
    expect(kenBurnsClass(false, false)).toBe(
      'animate-hero-kenburns motion-reduce:animate-none [animation-play-state:paused]'
    )
  })

  it('gives a weak device no zoom anywhere', () => {
    expect(kenBurnsClass(true, true)).toBe('')
    expect(kenBurnsClass(false, true)).toBe('')
  })
})

describe('cardExit', () => {
  it('throws a liked card right and a passed one left', () => {
    expect(cardExit(1, false)).toMatchObject({ x: 520, rotate: 18, opacity: 0 })
    expect(cardExit(-1, false)).toMatchObject({
      x: -520,
      rotate: -18,
      opacity: 0,
    })
  })

  it('only fades under reduced motion', () => {
    expect(cardExit(-1, true)).toEqual({ opacity: 0 })
  })

  // A removed card keeps the props of its last render, so the direction has to
  // reach its exit through AnimatePresence's `custom`, not through a prop.
  it('hands the direction to the leaving card through AnimatePresence', () => {
    const deck = readFileSync('components/match-night/swipe-deck.tsx', 'utf8')
    expect(deck).toMatch(/<AnimatePresence[^>]*custom=\{exitDirection\}/)
    expect(deck).toMatch(/exit: \(direction: SwipeDirection\) => cardExit\(/)
  })
})

/** The at-rules enclosing `index` in a stylesheet, outermost first. */
function enclosingRules(css: string, index: number): string[] {
  const stack: string[] = []
  let start = 0
  for (let i = 0; i < index; i++) {
    if (css[i] === '{')
      stack.push(css.slice(start, i).trim().split('\n').pop() ?? '')
    if (css[i] === '}') stack.pop()
    if (css[i] === '{' || css[i] === '}' || css[i] === ';') start = i + 1
  }
  return stack
}

describe('hero-kenburns keyframes', () => {
  // On 21 Oct they went back in inside @media (prefers-reduced-motion: reduce),
  // so the zoom existed only for people who asked for less motion: nobody saw
  // it until 17 Nov.
  it('are defined for everyone, not only under reduced motion', () => {
    const css = readFileSync('styles/globals.css', 'utf8')
    const defs = [...css.matchAll(/@keyframes hero-kenburns\b/g)].map((m) =>
      enclosingRules(css, m.index ?? 0)
    )
    expect(
      defs.some(
        (rules) => !rules.some((r) => r.includes('prefers-reduced-motion'))
      )
    ).toBe(true)
  })
})
