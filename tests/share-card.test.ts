import { describe, expect, it } from 'vitest'

import { layoutHeadline, type MeasureText } from '@/lib/canvas-card'
import {
  shareCardEyebrow,
  shareCardFileName,
  shareCardMetaLine,
  shareCardRatingLine,
} from '@/lib/share-card'

describe('shareCardFileName', () => {
  it('slugifies a title into a safe, lowercase filename', () => {
    expect(shareCardFileName('The Lord of the Rings')).toBe(
      'reely-the-lord-of-the-rings.png'
    )
  })

  it('folds accents and drops punctuation', () => {
    expect(shareCardFileName('Amélie: Un Film!')).toBe(
      'reely-amelie-un-film.png'
    )
  })

  it('never produces an empty basename', () => {
    // A title that is nothing but symbols still needs a file the download can
    // use — an empty basename would save as ".png" in some browsers.
    expect(shareCardFileName('!!!')).toBe('reely-title.png')
    expect(shareCardFileName('')).toBe('reely-title.png')
  })

  it('caps a very long title so the filename stays usable', () => {
    const name = shareCardFileName('The Extremely Long Subtitle '.repeat(20))
    expect(name.length).toBeLessThanOrEqual(60 + 'reely--.png'.length)
    expect(name.endsWith('.png')).toBe(true)
  })
})

describe('shareCardMetaLine', () => {
  it('joins year and genres with a middot', () => {
    expect(shareCardMetaLine(2024, ['Drama', 'Thriller'])).toBe(
      '2024 · Drama, Thriller'
    )
  })

  it('shows whichever fact it has', () => {
    expect(shareCardMetaLine(1999, [])).toBe('1999')
    expect(shareCardMetaLine(null, ['Comedy'])).toBe('Comedy')
  })

  it('returns null rather than an empty line', () => {
    expect(shareCardMetaLine(null, [])).toBeNull()
    expect(shareCardMetaLine(undefined, undefined)).toBeNull()
  })

  it('caps the genre list at three', () => {
    // Four genres on one line starts wrapping on a phone-sized thumbnail of
    // the card, which is where most people will actually see it.
    expect(shareCardMetaLine(2020, ['A', 'B', 'C', 'D'])).toBe('2020 · A, B, C')
  })
})

describe('shareCardRatingLine', () => {
  it('prefers a real IMDb score, like the page chip does', () => {
    expect(shareCardRatingLine('8.4', 7.1)).toBe('IMDb 8.4')
  })

  it('falls back to the rounded TMDB average', () => {
    expect(shareCardRatingLine(null, 7.26)).toBe('★ 7.3 TMDB')
  })

  it('prints nothing when there is no number', () => {
    // "NR" is the chip's answer because a chip occupies a fixed slot; a card
    // has room to omit the line rather than print a non-rating.
    expect(shareCardRatingLine(null, 0)).toBeNull()
    expect(shareCardRatingLine('', undefined)).toBeNull()
    expect(shareCardRatingLine(undefined, undefined)).toBeNull()
  })

  it('rejects a non-numeric IMDb string instead of printing NaN', () => {
    expect(shareCardRatingLine('n/a', 6.5)).toBe('★ 6.5 TMDB')
  })
})

describe('shareCardEyebrow', () => {
  it('names the site on every card', () => {
    expect(shareCardEyebrow).toBe('ON REELY')
  })
})

describe('layoutHeadline', () => {
  // Half an em per character: close enough to a bold sans to reason about.
  const measure: MeasureText = (text, size) => text.length * size * 0.5
  const WIDTH = 904 // the card's 1080 minus two 88px margins

  it('keeps a short title on one line at full size', () => {
    expect(layoutHeadline('Heat', WIDTH, measure)).toEqual({
      size: 84,
      lines: ['Heat'],
    })
  })

  it('shrinks onto one line while that stays readable', () => {
    // 28 chars: 28 * 64 * 0.5 = 896 fits at 64, above the 60px floor.
    const title = 'The Grand Budapest Hotel two'
    expect(layoutHeadline(title, WIDTH, measure)).toEqual({
      size: 64,
      lines: [title],
    })
  })

  it('breaks a long title into two balanced lines instead of a caption', () => {
    const title = 'Harry Potter and the Deathly Hallows: Part 2'
    const layout = layoutHeadline(title, WIDTH, measure)
    expect(layout.lines).toEqual([
      'Harry Potter and the',
      'Deathly Hallows: Part 2',
    ])
    // One line would have needed 40px; two lines hold 76px.
    expect(layout.size).toBe(76)
    for (const line of layout.lines) {
      expect(measure(line, layout.size)).toBeLessThanOrEqual(WIDTH)
    }
  })

  it('shrinks an unbreakable word rather than splitting it', () => {
    const word = 'Supercalifragilisticexpialidocious'
    const layout = layoutHeadline(word, WIDTH, measure)
    expect(layout.lines).toEqual([word])
    expect(measure(word, layout.size)).toBeLessThanOrEqual(WIDTH)
  })
})
