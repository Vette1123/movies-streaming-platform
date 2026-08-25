import { describe, expect, it } from 'vitest'

import { isImdbId } from '@/lib/imdb-id'

// This exists because the shape was hand-written three times and one copy lost
// a backslash — `/^ttd{5,12}$/` matches `tt` followed by literal `d`s, so it
// accepted nothing and rejected every real id. Nothing failed loudly: the
// playback ticket simply stopped carrying the IMDb id, the player lost its
// cheapest subtitle source, and every request paid the three-catalog walk.
describe('isImdbId', () => {
  it('accepts the ids TMDB actually returns', () => {
    expect(isImdbId('tt0133093')).toBe(true) // 7 digits
    expect(isImdbId('tt13111078')).toBe(true) // 8 digits
    expect(isImdbId('TT0133093')).toBe(true) // case-insensitive
  })

  it('rejects the literal-d shape the broken copy accepted', () => {
    expect(isImdbId('ttddddd')).toBe(false)
  })

  it('rejects everything that is not a title id', () => {
    expect(isImdbId('nm0000138')).toBe(false) // a person, not a title
    expect(isImdbId('tt123')).toBe(false) // too short
    expect(isImdbId('tt0133093x')).toBe(false) // trailing junk
    expect(isImdbId(' tt0133093')).toBe(false) // untrimmed
    expect(isImdbId('550')).toBe(false) // a TMDB id
    expect(isImdbId(undefined)).toBe(false)
    expect(isImdbId(null)).toBe(false)
    expect(isImdbId(1234)).toBe(false)
  })
})
