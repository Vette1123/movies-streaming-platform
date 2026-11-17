import { describe, expect, it } from 'vitest'

import { shortcutsVisible } from '@/lib/search-shortcuts'

// The shortcuts group sat below the idle hint. The first query swapped the hint
// for a taller skeleton and pushed the visible shortcuts out of the phone
// viewport: one 0.247 shift. Shortcuts now belong to the idle panel only.
describe('shortcutsVisible', () => {
  it('shows the shortcuts only before a search', () => {
    expect(shortcutsVisible('idle')).toBe(true)
  })
  it('never keeps them under a search in any state', () => {
    for (const s of ['loading', 'results', 'empty', 'link', 'failed'] as const)
      expect(shortcutsVisible(s)).toBe(false)
  })
})
