import { describe, expect, it } from 'vitest'

import { isSlideMounted } from '@/lib/carousel-window'

const before = { neighboursReady: false }
const after = { neighboursReady: true }

describe('isSlideMounted', () => {
  it('leaves the neighbours out of the first render', () => {
    expect(isSlideMounted({ active: true, distance: 0, ...before })).toBe(true)
    expect(isSlideMounted({ active: false, distance: 1, ...before })).toBe(
      false
    )
    expect(isSlideMounted({ active: false, distance: -1, ...before })).toBe(
      false
    )
  })

  it('keeps one neighbour each side once they are allowed', () => {
    expect(isSlideMounted({ active: false, distance: 1, ...after })).toBe(true)
    expect(isSlideMounted({ active: false, distance: -1, ...after })).toBe(true)
    expect(isSlideMounted({ active: false, distance: 2, ...after })).toBe(false)
  })

  it('never unmounts the slide on screen, however far the lagging index is', () => {
    expect(isSlideMounted({ active: true, distance: 3, ...before })).toBe(true)
    expect(isSlideMounted({ active: true, distance: 3, ...after })).toBe(true)
  })

  it('keeps the outgoing slide while the lagging index still points at it', () => {
    expect(isSlideMounted({ active: false, distance: 0, ...before })).toBe(true)
  })
})
