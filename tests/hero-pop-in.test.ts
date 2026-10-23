import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { RatingTile } from '@/lib/ratings'
import { isRecentlyReleased } from '@/lib/utils'
import { RatingsPills } from '@/components/media/ratings-strip'

// Two things on the heroes arrived late or never: the "New" badge waited for
// the whole page to hydrate (a mount gate), and the ratings row needed two
// sources, which a new release almost never has.

const tmdb: RatingTile = {
  id: 'tmdb',
  label: 'TMDB',
  score: '7.3',
  detail: '75 votes',
  tone: 'tmdb',
}

describe('the hero ratings row', () => {
  it('shows a lone TMDB score (most hero slides are new releases)', () => {
    expect(
      renderToStaticMarkup(createElement(RatingsPills, { tiles: [tmdb] }))
    ).toContain('7.3')
  })

  it('renders nothing with no ratings at all', () => {
    expect(
      renderToStaticMarkup(createElement(RatingsPills, { tiles: [] }))
    ).toBe('')
  })
})

describe('the "New" badge is decided against a fixed clock', () => {
  const day = 24 * 60 * 60 * 1000
  const build = Date.parse('2026-10-23T00:00:00Z')

  it('is recent inside the window, measured from the given clock', () => {
    expect(isRecentlyReleased('2026-10-20', 14, build)).toBe(true)
    expect(isRecentlyReleased('2026-10-20', 14, build + 30 * day)).toBe(false)
  })

  it('is not new before release', () => {
    expect(isRecentlyReleased('2026-11-01', 14, build)).toBe(false)
  })

  it('renders in the server HTML, with no mount gate', async () => {
    process.env.NEXT_PUBLIC_BUILD_TIME = String(Date.now())
    const { NewBadgeWhenRecent } =
      await import('@/components/new-badge-when-recent')
    const today = new Date().toISOString().slice(0, 10)
    expect(
      renderToStaticMarkup(createElement(NewBadgeWhenRecent, { date: today }))
    ).not.toBe('')
  })
})
