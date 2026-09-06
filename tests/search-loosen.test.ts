import { describe, expect, it } from 'vitest'

import { looksLikeUrl, looseningVariants } from '@/lib/search-loosen'

/**
 * Every query in here is one a real visitor typed into the live site and got
 * nothing back for, taken from five days of `search_no_results`. The expected
 * variant beside it is the one that was verified against production to return
 * the title they were obviously looking for — so these are not invented cases,
 * they are the actual failure list.
 */
describe('looseningVariants', () => {
  it('recovers a typo at the end of a word by shortening the prefix', () => {
    // TMDB prefix-matches, so one wrong letter at the end kills the match and
    // dropping it restores it. Verified: `godfath` -> The Godfather.
    expect(looseningVariants('godfathr')).toContain('godfath')
    expect(looseningVariants('spidermn')).toContain('spiderm')
    expect(looseningVariants('avatr')).toContain('avat')
    expect(looseningVariants('conjut')).toContain('conju')
  })

  it('keeps shortening when one character is not enough', () => {
    // `possesion` needs three off the end before `posses` finds Possession.
    expect(looseningVariants('possesion')).toContain('posses')
  })

  it('drops the misspelt word from a phrase rather than editing it', () => {
    // The other words are spelt correctly; `shawshank` finds the film.
    expect(looseningVariants('shawshank redemtion')[0]).toBe('shawshank')
  })

  it('falls back to the longest word when the noise is at the end', () => {
    // `Ride lr die` -> `Ride` finds Ride or Die.
    expect(looseningVariants('Ride lr die')).toContain('Ride')
  })

  it('never offers the original query back', () => {
    expect(looseningVariants('batman')).not.toContain('batman')
  })

  it('never offers a prefix too short to mean anything', () => {
    // Three characters match half the catalogue; that is not a rescue.
    for (const v of looseningVariants('abcd'))
      expect(v.length).toBeGreaterThanOrEqual(4)
    expect(looseningVariants('cat')).toEqual([])
  })

  it('has nothing to offer for a pasted link', () => {
    expect(
      looseningVariants('https://www.youtube.com/watch?v=YQHsXMglZpg')
    ).toEqual([])
  })

  it('returns variants without duplicates', () => {
    const out = looseningVariants('interstellar')
    expect(new Set(out).size).toBe(out.length)
  })
})

describe('looksLikeUrl', () => {
  it('recognises the links people actually paste', () => {
    // 29% of the zero-result searches were exactly these two hosts.
    expect(looksLikeUrl('https://www.youtube.com/watch?v=YQHsXMglZpg')).toBe(
      true
    )
    expect(looksLikeUrl('https://www.instagram.com/reel/DE-subxS2')).toBe(true)
    expect(looksLikeUrl('www.imdb.com/title/tt0137523')).toBe(true)
  })

  it('does not mistake a title for a link', () => {
    expect(looksLikeUrl('The Matrix')).toBe(false)
    expect(looksLikeUrl('wall e')).toBe(false)
    // A title containing a dot is still a title.
    expect(looksLikeUrl('S.W.A.T.')).toBe(false)
  })

  it('does not treat a sentence containing a link as a link', () => {
    // Two tokens: they typed something around it, so search what they typed.
    expect(looksLikeUrl('watch https://youtu.be/abc')).toBe(false)
  })
})
