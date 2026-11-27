import { describe, expect, it } from 'vitest'

import { collectionIntro } from '@/lib/collection-intro'

/**
 * GSC filed 24 /collection/<id> pages as "Crawled - currently not indexed"
 * (2026-11-27): each carried the name, TMDB's one-line overview and a poster
 * grid. The intro states what the franchise holds, from the parts already fetched.
 */
const part = (
  title: string,
  release_date: string,
  vote_average = 0,
  vote_count = 0
) => ({ title, release_date, vote_average, vote_count })

describe('collectionIntro', () => {
  it('names the span, the first and latest film, and the best rated', () => {
    expect(
      collectionIntro('The Matrix Collection', [
        part('The Matrix Reloaded', '2003-05-15', 7.0, 11000),
        part('The Matrix', '1999-03-31', 8.2, 26000),
        part('The Matrix Resurrections', '2021-12-16', 6.4, 6000),
        part('The Matrix Revolutions', '2003-11-05', 6.7, 9000),
      ])
    ).toBe(
      'The Matrix Collection spans 4 movies released from 1999 to 2021, ' +
        'from The Matrix to The Matrix Resurrections. ' +
        'The best rated on TMDB is The Matrix at 8.2/10. ' +
        'They are listed below in release order, each with its rating, cast and where to watch it.'
    )
  })

  it('reads naturally for one film, or several in one year', () => {
    expect(collectionIntro('Solo Saga', [part('Solo', '2018-05-15')])).toBe(
      'Solo Saga holds 1 movie so far, Solo (2018). ' +
        'It is listed below with its rating, cast and where to watch it.'
    )
    expect(
      collectionIntro('Twins', [
        part('A', '2020-01-01'),
        part('B', '2020-06-01'),
      ])
    ).toContain('spans 2 movies released in 2020, from A to B.')
  })

  it('skips a rating nobody voted on, and an undated sequel cannot be the latest', () => {
    const text = collectionIntro('Saga', [
      part('One', '2010-01-01', 9.9, 3),
      part('Two', '2012-01-01'),
      part('Three', ''),
    ])
    expect(text).toContain(
      'spans 3 movies released from 2010 to 2012, from One to Two.'
    )
    expect(text).not.toContain('best rated')
  })

  it('falls back to a plain line when no part has a date or there are no parts', () => {
    expect(collectionIntro('Saga', [part('X', ''), part('Y', '')])).toBe(
      'Saga holds 2 movies. They are listed below, each with its rating, cast and where to watch it.'
    )
    expect(collectionIntro('Empty', [])).toBe('')
    expect(
      collectionIntro('Saga', [part('Solo', '2018-05-15'), part('Next', '')])
    ).toContain('Saga holds 2 movies, starting with Solo (2018).')
  })
})
