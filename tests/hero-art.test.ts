import { describe, expect, it } from 'vitest'

import { canWarmHeroArt, heroArtReady } from '@/lib/hero-art'

describe('canWarmHeroArt', () => {
  it('warms when the browser reports nothing', () => {
    expect(canWarmHeroArt(undefined)).toBe(true)
  })

  it('warms on a good link', () => {
    expect(canWarmHeroArt({ effectiveType: '4g' })).toBe(true)
  })

  it('holds back on data saver and on 2g', () => {
    expect(canWarmHeroArt({ saveData: true, effectiveType: '4g' })).toBe(false)
    expect(canWarmHeroArt({ effectiveType: 'slow-2g' })).toBe(false)
    expect(canWarmHeroArt({ effectiveType: '2g' })).toBe(false)
  })
})

describe('heroArtReady', () => {
  const parked = { priority: false, active: false, warm: false }

  it('keeps a parked neighbour off the network during first load', () => {
    expect(heroArtReady(parked)).toBe(false)
  })

  it('always renders the first slide', () => {
    expect(heroArtReady({ ...parked, priority: true })).toBe(true)
  })

  it('renders a slide swiped on stage before the page finished loading', () => {
    expect(heroArtReady({ ...parked, active: true })).toBe(true)
  })

  it('warms neighbours once the page has loaded', () => {
    expect(heroArtReady({ ...parked, warm: true })).toBe(true)
  })
})
