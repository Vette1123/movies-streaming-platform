import { describe, expect, it } from 'vitest'

import { chipRowState } from '@/lib/search-chip-row'

// Typing in the search palette went results -> loading -> results, and the chip
// row was removed during loading: a 41px jump of the list on every keystroke.
describe('chipRowState', () => {
  it('keeps the row space while the next search is loading', () => {
    expect(chipRowState('loading', 0)).toBe('reserved')
  })
  it('holds the space before the first keystroke too', () => {
    expect(chipRowState('idle', 0)).toBe('reserved')
  })
  it('shows the row with results and drops it when there are none', () => {
    expect(chipRowState('results', 5)).toBe('shown')
    expect(chipRowState('empty', 0)).toBe('none')
    expect(chipRowState('failed', 0)).toBe('none')
  })
})
