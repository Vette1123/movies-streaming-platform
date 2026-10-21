import {
  parseOmdbRatings,
  parseOmdbScore,
  parseOmdbVotes,
} from '@/services/omdb'
import { describe, expect, it } from 'vitest'

import { buildRatingTiles, formatVotes } from '@/lib/ratings'

/**
 * The ratings row is the only place on the site that states what other people
 * think of a film, so two things are pinned here: that a number is never
 * invented, and that a missing score leaves no hole in the page.
 *
 * A tile that says "NR" is a claim about the film; a missing tile is not.
 */

describe('buildRatingTiles', () => {
  it('reads every source it is given, TMDB first', () => {
    const tiles = buildRatingTiles({
      imdbRating: '8.6',
      imdbVotes: 2_948_373,
      rottenTomatoes: 93,
      metacritic: 82,
      tmdbAverage: 8.1,
      tmdbVotes: 12_400,
    })

    // TMDB leads because it is the score the site shows everywhere else - on
    // every card, on the hero, and in the JSON-LD. A reader who saw "8" on a
    // card and "IMDb 9.3" on the details page had no way to know that was two
    // sources rather than one number that changed.
    expect(tiles.map((tile) => tile.id)).toEqual([
      'tmdb',
      'imdb',
      'rottenTomatoes',
      'metacritic',
    ])
    expect(tiles[0]).toMatchObject({
      label: 'TMDB',
      score: '8.1',
      detail: '12.4K votes',
    })
    expect(tiles[1]).toMatchObject({
      label: 'IMDb',
      score: '8.6',
      detail: '2.9M votes',
    })
    expect(tiles[2]).toMatchObject({ label: 'Rotten Tomatoes', score: '93%' })
    expect(tiles[3]).toMatchObject({ label: 'Metacritic', score: '82' })
  })

  it('writes the same number the card writes', () => {
    // The card's chip says "8.1", so the strip must not say "8".
    const tiles = buildRatingTiles({ tmdbAverage: 8 })
    expect(tiles[0].score).toBe('8.0')
  })

  it('leaves out a source with no score instead of showing an empty box', () => {
    const tiles = buildRatingTiles({
      imdbRating: null,
      rottenTomatoes: null,
      metacritic: undefined,
      tmdbAverage: 7.4,
    })

    expect(tiles).toHaveLength(1)
    expect(tiles[0].id).toBe('tmdb')
  })

  it('returns nothing at all when there is nothing to say', () => {
    expect(buildRatingTiles({})).toEqual([])
  })

  it("uses each source's own band for the score colour", () => {
    const tone = (input: Parameters<typeof buildRatingTiles>[0]) =>
      buildRatingTiles(input)[0]?.tone

    // Rotten Tomatoes draws its line at 60.
    expect(tone({ rottenTomatoes: 60 })).toBe('fresh')
    expect(tone({ rottenTomatoes: 59 })).toBe('rotten')
    // Metacritic bands at 75 and 50.
    expect(tone({ metacritic: 75 })).toBe('metacritic-good')
    expect(tone({ metacritic: 50 })).toBe('metacritic-mid')
    expect(tone({ metacritic: 49 })).toBe('metacritic-bad')
  })

  it('ignores a zero score rather than printing it', () => {
    expect(buildRatingTiles({ imdbRating: '0.0' })).toEqual([])
    expect(buildRatingTiles({ tmdbAverage: 0 })).toEqual([])
  })
})

describe('formatVotes', () => {
  it('reads a count the way a person does', () => {
    expect(formatVotes(2_948_373)).toBe('2.9M')
    expect(formatVotes(12_400)).toBe('12.4K')
    expect(formatVotes(843)).toBe('843')
    expect(formatVotes(0)).toBe('0')
  })

  it('has no answer for a count that is not a count', () => {
    expect(formatVotes(null)).toBeUndefined()
    expect(formatVotes(undefined)).toBeUndefined()
    expect(formatVotes(Number.NaN)).toBeUndefined()
    expect(formatVotes(-1)).toBeUndefined()
  })
})

describe('parseOmdbScore', () => {
  it('reads every shape OMDb writes', () => {
    expect(parseOmdbScore('91%')).toBe(91)
    expect(parseOmdbScore('82/100')).toBe(82)
    expect(parseOmdbScore('9.3/10')).toBe(9.3)
    expect(parseOmdbScore('9.3')).toBe(9.3)
  })

  it('has no score for the shapes that are not scores', () => {
    expect(parseOmdbScore('N/A')).toBeNull()
    expect(parseOmdbScore('')).toBeNull()
    expect(parseOmdbScore(undefined)).toBeNull()
    expect(parseOmdbScore('abc')).toBeNull()
  })
})

describe('parseOmdbVotes', () => {
  it('reads a count with its separators', () => {
    expect(parseOmdbVotes('2,948,373')).toBe(2_948_373)
    expect(parseOmdbVotes('1,234')).toBe(1234)
  })

  it('has no count for the shapes that are not counts', () => {
    expect(parseOmdbVotes('N/A')).toBeNull()
    expect(parseOmdbVotes('')).toBeNull()
    expect(parseOmdbVotes(undefined)).toBeNull()
  })
})

describe('parseOmdbRatings', () => {
  it('reads the Tomatometer and the Metascore out of the ratings array', () => {
    const ratings = parseOmdbRatings({
      Response: 'True',
      imdbRating: '9.3',
      imdbVotes: '2,948,373',
      Ratings: [
        { Source: 'Internet Movie Database', Value: '9.3/10' },
        { Source: 'Rotten Tomatoes', Value: '91%' },
        { Source: 'Metacritic', Value: '82/100' },
      ],
    })

    expect(ratings).toEqual({
      imdbRating: 9.3,
      imdbVotes: 2_948_373,
      rottenTomatoes: 91,
      metacritic: 82,
    })
  })

  it('falls back to the top-level Metascore', () => {
    const ratings = parseOmdbRatings({
      Response: 'True',
      Metascore: '64',
      Ratings: [{ Source: 'Rotten Tomatoes', Value: '77%' }],
    })

    expect(ratings?.metacritic).toBe(64)
    expect(ratings?.rottenTomatoes).toBe(77)
  })

  it('has no answer for a title OMDb does not know', () => {
    expect(
      parseOmdbRatings({ Response: 'False', Error: 'Movie not found!' })
    ).toBeNull()
    expect(parseOmdbRatings(null)).toBeNull()
    expect(parseOmdbRatings({ Response: 'True' })).toBeNull()
  })
})
