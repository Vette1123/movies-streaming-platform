import { describe, expect, it } from 'vitest'

import {
  ImdbMark,
  MetacriticMark,
  ratingMark,
  RtFreshMark,
  RtRottenMark,
  TmdbMark,
} from '@/components/media/rating-marks'

// The ratings row shipped with four coloured dots standing in for the source
// logos. Every source maps to its own mark, and Rotten Tomatoes follows the
// verdict the way the site itself does.
describe('ratingMark', () => {
  it('gives every source its own mark', () => {
    expect(ratingMark({ id: 'tmdb', tone: 'tmdb' })).toBe(TmdbMark)
    expect(ratingMark({ id: 'imdb', tone: 'imdb' })).toBe(ImdbMark)
    expect(ratingMark({ id: 'metacritic', tone: 'metacritic-good' })).toBe(
      MetacriticMark
    )
  })

  it('shows the tomato when fresh and the splat when rotten', () => {
    expect(ratingMark({ id: 'rottenTomatoes', tone: 'fresh' })).toBe(
      RtFreshMark
    )
    expect(ratingMark({ id: 'rottenTomatoes', tone: 'rotten' })).toBe(
      RtRottenMark
    )
  })
})
