import { describe, expect, it } from 'vitest'

import { initialsOf, tintBackground, tintHue } from '@/lib/monogram'

// A missing headshot or poster rendered as a blank grey box (the Crew row on a
// details page was three empty slabs). The fallback is built from the name.
describe('initialsOf', () => {
  it('takes the first and last word', () => {
    expect(initialsOf("Matt O'Brien")).toBe('MO')
    expect(initialsOf('Mary Elizabeth Winstead')).toBe('MW')
    expect(initialsOf('  tracy   king ')).toBe('TK')
  })

  it('handles one-word, empty and non-Latin names', () => {
    expect(initialsOf('Cher')).toBe('C')
    expect(initialsOf('')).toBe('?')
    expect(initialsOf('   ')).toBe('?')
    expect(initialsOf('محمد صلاح')).toBe('مص')
    // Never half a surrogate pair.
    expect(initialsOf('😀 Smile')).toBe('😀S')
  })
})

describe('tintHue', () => {
  it('is stable and in range', () => {
    expect(tintHue('Mike Sweeney')).toBe(tintHue('Mike Sweeney'))
    for (const name of ['', 'a', 'Matt O’Brien', 'x'.repeat(500)]) {
      const h = tintHue(name)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
  })

  it('tells neighbours apart', () => {
    const hues = new Set(
      ["Matt O'Brien", 'Tracy King', 'Mike Sweeney'].map(tintHue)
    )
    expect(hues.size).toBe(3)
  })

  it('paints a gradient, never a flat fill', () => {
    expect(tintBackground('Tracy King').backgroundImage).toMatch(
      /^radial-gradient\(.+linear-gradient\(/
    )
  })
})
