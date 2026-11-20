import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { RAIL_WIDE_POSTER_COUNT } from '@/lib/rail-scroll'

// What a refresh paints first. These live in components with no pure seam, so
// the source is the closest place to pin them; each was seen in a browser.

describe('a refresh paints where you were', () => {
  it('hands the history entry back to the browser as the page goes', () => {
    // `manual` sticks to the entry: the refresh painted the hero at the top and
    // jumped down after hydration (measured: first frame y=0, now y=1800).
    const source = readFileSync('components/back-restore.tsx', 'utf8')
    expect(source).toMatch(
      /const onPageHide = \(\) => \{[\s\S]*?history\.scrollRestoration = 'auto'/
    )
    expect(source).toContain("window.addEventListener('pagehide', onPageHide)")
  })
})

describe('a static rail never slides a dark box into view', () => {
  it('renders every poster once the track is scrolled', () => {
    const source = readFileSync('components/main-page/static-rail.tsx', 'utf8')
    expect(source).toContain('onScroll={onTrackScroll}')
    expect(source).toContain('card.poster || scrolled')
  })

  it('reserves skeleton cells for the widest screen', () => {
    const loader = readFileSync(
      'components/loaders/slider-horizontal-list-loader.tsx',
      'utf8'
    )
    expect(loader).toContain('length: RAIL_WIDE_POSTER_COUNT')
    expect(RAIL_WIDE_POSTER_COUNT).toBeGreaterThanOrEqual(19)
  })
})

describe('the hero mounts its neighbours before an arrow is used', () => {
  it('on a mouse entering or a key focusing the stage', () => {
    const source = readFileSync('components/carousel.tsx', 'utf8')
    expect(source).toContain('onMouseEnter={onStageEnter}')
    expect(source).toContain('onFocus={readyNeighbours}')
  })
})
