import { describe, expect, it } from 'vitest'

import { decimalsOf } from '@/components/media/count-up-number'

// The count-up lands on `target.toFixed(decimalsOf(score))`, so this is what
// the reader sees once the animation ends. It used to be a fixed toFixed(1),
// which turned Metacritic's 67 into "67.0".
describe('a counted-up score lands in its own format', () => {
  it.each([
    ['67', 0],
    ['8.4', 1],
    ['7.25', 2],
  ])('%s keeps %i decimals', (score, decimals) => {
    expect(decimalsOf(score)).toBe(decimals)
    expect(Number(score).toFixed(decimalsOf(score))).toBe(score)
  })
})
