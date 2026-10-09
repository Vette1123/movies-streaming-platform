import { describe, expect, it } from 'vitest'

import { heroTitleState } from '@/lib/hero-title'

const base = {
  hasLogo: true,
  logoLoaded: false,
  logoError: false,
  extrasReady: true,
  graceElapsed: false,
}

describe('heroTitleState', () => {
  it('shows the wordmark before JS has seen it load (no hydration gate)', () => {
    // Pre-hydration, logoLoaded is still false. The logo must be rendered
    // visible anyway, so it paints the moment the browser decodes it.
    expect(heroTitleState(base)).toEqual({ logo: true, text: false })
  })

  it('keeps the text hidden once the wordmark has decoded', () => {
    expect(
      heroTitleState({ ...base, logoLoaded: true, graceElapsed: true })
    ).toEqual({ logo: true, text: false })
  })

  it('lets the text cover a wordmark still missing after the grace', () => {
    expect(heroTitleState({ ...base, graceElapsed: true })).toEqual({
      logo: true,
      text: true,
    })
  })

  it('falls back to text when the wordmark fails', () => {
    expect(heroTitleState({ ...base, logoError: true })).toEqual({
      logo: false,
      text: true,
    })
  })

  it('shows text for a title with no wordmark, once that is known', () => {
    expect(heroTitleState({ ...base, hasLogo: false })).toEqual({
      logo: false,
      text: true,
    })
    expect(
      heroTitleState({ ...base, hasLogo: false, extrasReady: false })
    ).toEqual({ logo: false, text: false })
  })
})
