import { describe, expect, it } from 'vitest'

import { genreIntro } from '@/lib/genre-intro'

/**
 * GSC filed /movies/genre/{animation,drama,western} and /tv-shows/genre/western as
 * "Crawled - currently not indexed" (2026-11-26): every genre page carried the same
 * one-line template. The intro now names what the page actually lists.
 */
describe('genreIntro', () => {
  const names = ['Kalki 2898-AD', 'A Story of Derry', 'The Godfather', 'Fifth']

  it('names the top three titles and the total, so each genre page reads differently', () => {
    expect(genreIntro('Drama', 'movies', names, 1234)).toBe(
      'The most popular drama movies on Reely right now are Kalki 2898-AD, A Story of Derry and The Godfather. ' +
        "Browse the most popular of TMDB's 1,234 drama movies, each with its rating, cast and where to watch it."
    )
  })

  it('reads naturally with one or two titles', () => {
    expect(genreIntro('Western', 'TV shows', ['Yellowstone'], 1)).toBe(
      'The most popular western TV show on Reely right now is Yellowstone. ' +
        'Browse it by popularity, with its rating, cast and where to watch it.'
    )
    expect(genreIntro('News', 'TV shows', ['A', 'B'], 2)).toContain(
      'right now are A and B.'
    )
  })

  it('falls back to the plain line when the build got no titles (TMDB fail-soft)', () => {
    expect(genreIntro('Animation', 'movies', [], 0)).toBe(
      'Popular animation movies, refreshed regularly.'
    )
  })

  it('never prints the capped count TMDB sends for a big genre', () => {
    const text = genreIntro('Drama', 'movies', names, 20001)
    expect(text).not.toContain('20,001')
    expect(text).toContain('Browse thousands of drama movies by popularity')
  })

  it('omits the count when TMDB does not send one', () => {
    expect(genreIntro('Drama', 'movies', names, undefined)).toContain(
      'Browse drama movies by popularity'
    )
  })
})
