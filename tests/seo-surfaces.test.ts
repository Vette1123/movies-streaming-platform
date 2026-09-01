import { describe, expect, it } from 'vitest'

import type { Credit } from '@/types/credit'
import { castNames, crewNamesByJob, trimCredits } from '@/lib/credits'
import {
  collectionDescription,
  mediaDescription,
  trimBiography,
} from '@/lib/seo-description'
import { itemListJsonLd, movieJsonLd } from '@/lib/structured-data'
import { listSentence } from '@/lib/utils'
import { FIRST_YEAR, isValidYear } from '@/components/media/year-page'

describe('listSentence', () => {
  it('reads for one, two and three', () => {
    expect(listSentence([])).toBe('')
    expect(listSentence(['Max'])).toBe('Max')
    expect(listSentence(['Max', 'Hulu'])).toBe('Max and Hulu')
    expect(listSentence(['Max', 'Hulu', 'Netflix'])).toBe(
      'Max, Hulu and Netflix'
    )
  })
})

// ---------------------------------------------------------------------------
// Structured data. Wrong markup is worse than none — Google penalises claims a
// page does not support, so every optional field must stay absent when empty.
// ---------------------------------------------------------------------------

const credits = {
  id: 1,
  cast: [
    { id: 2, name: 'Second', order: 1 },
    { id: 1, name: 'First', order: 0 },
  ],
  crew: [
    { id: 9, name: 'Dee Rector', job: 'Director' },
    { id: 9, name: 'Dee Rector', job: 'Director' },
    { id: 8, name: 'Not Them', job: 'Editor' },
  ],
} as unknown as Credit

describe('credits', () => {
  it('returns billed order regardless of the order TMDB sent', () => {
    expect(castNames(credits)).toEqual(['First', 'Second'])
  })

  it('de-duplicates a person credited twice for the same job', () => {
    expect(crewNamesByJob(credits, 'Director')).toEqual(['Dee Rector'])
  })

  it('is empty rather than undefined for a title with no credits', () => {
    expect(castNames(undefined)).toEqual([])
    expect(crewNamesByJob(undefined, 'Director')).toEqual([])
  })
})

describe('trimCredits', () => {
  it('keeps ten cast in billed order and drops the rest', () => {
    const many = {
      id: 7,
      cast: Array.from({ length: 40 }, (_, index) => ({
        id: index,
        name: `Actor ${index}`,
        order: 39 - index,
      })),
      crew: [],
    } as unknown as Credit
    const trimmed = trimCredits(many, 7)
    expect(trimmed.cast).toHaveLength(10)
    expect(trimmed.cast[0].name).toBe('Actor 39')
    // The rail slices the first ten as given and castNames sorts before it
    // slices. They have to agree about who the tenth person is.
    expect(trimmed.cast.map((person) => person.name)).toEqual(
      castNames(many, 10)
    )
  })

  it('keeps every director and no other job', () => {
    const trimmed = trimCredits(credits, 1)
    expect(trimmed.crew.map((person) => person.job)).toEqual([
      'Director',
      'Director',
    ])
    expect(crewNamesByJob(trimmed, 'Director')).toEqual(['Dee Rector'])
  })

  it('survives a title TMDB returned no credits block for', () => {
    expect(trimCredits(undefined, 42)).toEqual({ id: 42, cast: [], crew: [] })
  })
})

describe('movie schema', () => {
  const base = { id: 550, title: 'Fight Club' }

  it('omits the trailer when there is no publish date to claim', () => {
    const schema = movieJsonLd({ ...base, trailerKey: 'abc' })
    expect(schema.trailer).toBeUndefined()
  })

  it('publishes a VideoObject with the clip own date, not the release date', () => {
    const schema = movieJsonLd({
      ...base,
      releaseDate: '1999-10-15',
      trailerKey: 'abc',
      trailerPublishedAt: '2014-01-02T00:00:00.000Z',
    }) as { trailer: Record<string, string> }
    expect(schema.trailer['@type']).toBe('VideoObject')
    expect(schema.trailer.uploadDate).toBe('2014-01-02T00:00:00.000Z')
    expect(schema.trailer.embedUrl).toBe('https://www.youtube.com/embed/abc')
  })

  it('omits actor and director rather than publishing empty arrays', () => {
    const schema = movieJsonLd({ ...base, cast: [], directors: [null] })
    expect(schema.actor).toBeUndefined()
    expect(schema.director).toBeUndefined()
  })
})

describe('ItemList', () => {
  const entries = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    name: `Title ${i}`,
    path: `/movies/${i}`,
    image: i % 2 ? `poster-${i}` : null,
  }))

  it('caps the list and numbers it from one', () => {
    const list = itemListJsonLd(entries, { name: 'Popular', url: '/movies' })
    expect(list.itemListElement).toHaveLength(20)
    expect(list.numberOfItems).toBe(20)
    expect(list.itemListElement[0].position).toBe(1)
  })

  it('makes every item URL absolute', () => {
    const list = itemListJsonLd(entries.slice(0, 1), {
      name: 'Popular',
      url: '/movies',
    })
    expect(list.itemListElement[0].url).toMatch(/^https?:\/\/.+\/movies\/0$/)
  })
})

// ---------------------------------------------------------------------------
// Year hubs. dynamicParams is false, so a year outside the range must be
// rejected by the same rule that decided what got built.
// ---------------------------------------------------------------------------

describe('year hubs', () => {
  it('accepts a year in range', () => {
    expect(isValidYear(String(FIRST_YEAR))).toBe(true)
    expect(isValidYear(String(new Date().getFullYear()))).toBe(true)
  })

  it('rejects everything outside it', () => {
    expect(isValidYear(String(FIRST_YEAR - 1))).toBe(false)
    expect(isValidYear(String(new Date().getFullYear() + 1))).toBe(false)
    expect(isValidYear('20o5')).toBe(false)
    expect(isValidYear('2005a')).toBe(false)
    expect(isValidYear('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Meta descriptions. Bing flagged 53 detail pages as "too short" — every one a
// title whose TMDB overview is a single line or missing. The old builder was
// `overview.slice(0, 200) || <48-char fallback>`, so a thin overview produced a
// thin description and a long one was cut mid-word.
// ---------------------------------------------------------------------------

const LONG_OVERVIEW =
  'A cartographer is hired to map a stretch of coast nobody has surveyed since the war, and finds the villages on his employer\u2019s chart do not exist. The deeper he walks the less the land agrees with the paper in his hands.'

describe('mediaDescription', () => {
  const base = {
    title: 'Forbidden Daughters',
    year: '1927',
    kind: 'movie' as const,
    genres: ['Drama', 'Romance'],
  }

  it('fills the slot when TMDB has no overview at all', () => {
    const description = mediaDescription({ ...base, overview: undefined })
    expect(description.length).toBeGreaterThanOrEqual(120)
    expect(description.length).toBeLessThanOrEqual(158)
    expect(description).toContain('Forbidden Daughters (1927)')
    expect(description).toContain('drama, romance movie')
  })

  it('fills the slot when the overview is one short line', () => {
    const description = mediaDescription({
      ...base,
      overview: 'Japanese nunsploitation movie from 1998',
    })
    expect(description.length).toBeGreaterThanOrEqual(120)
    expect(description.length).toBeLessThanOrEqual(158)
    expect(description).toContain('Japanese nunsploitation movie from 1998.')
  })

  it('leaves a long overview alone, cut on a word boundary', () => {
    const description = mediaDescription({ ...base, overview: LONG_OVERVIEW })
    expect(description.length).toBeLessThanOrEqual(158)
    expect(description.endsWith('…')).toBe(true)
    // The old slice(0, 200) ended '...do not e'. Nothing may be cut mid-word.
    expect(LONG_OVERVIEW).toContain(description.slice(0, -1))
    expect(description.slice(0, -1).endsWith(' ')).toBe(false)
  })

  it('never appends an offer it cannot finish', () => {
    for (const length of [0, 20, 60, 100, 129, 130, 200]) {
      const description = mediaDescription({
        ...base,
        overview: 'word '.repeat(Math.ceil(length / 5)).slice(0, length),
      })
      expect(description.length).toBeLessThanOrEqual(158)
      // An ellipsis is only ever the synopsis being trimmed — the closing
      // sentence is either present whole or not at all.
      expect(description).not.toMatch(/on Reel…?$/)
      if (description.includes('on Reely')) {
        expect(description.endsWith('on Reely.')).toBe(true)
      }
    }
  })

  it('says series for a series and folds whitespace', () => {
    const description = mediaDescription({
      title: 'House of Rock',
      kind: 'series',
      overview: '  \n  ',
    })
    expect(description).toContain('House of Rock — series.')
    expect(description).not.toMatch(/\s{2}/)
  })
})

describe('collectionDescription', () => {
  it('fills the slot for the franchise pages TMDB leaves blank', () => {
    const description = collectionDescription('Lilo & Stitch Collection', '')
    expect(description.length).toBeGreaterThanOrEqual(120)
    expect(description.length).toBeLessThanOrEqual(158)
    expect(description).toContain('The Lilo & Stitch Collection, complete.')
    expect(description.endsWith('on Reely.')).toBe(true)
  })

  it('leads with the overview when TMDB has one', () => {
    const description = collectionDescription(
      'Alien Collection',
      'The crew of a commercial towing ship answers a distress call.'
    )
    expect(description.startsWith('The crew of a commercial towing ship')).toBe(
      true
    )
    expect(description.length).toBeLessThanOrEqual(158)
  })
})

describe('trimBiography', () => {
  const attribution =
    'Description above from the Wikipedia article Tom Hanks, licensed under CC-BY-SA, full list of contributors on Wikipedia.'

  it('leaves a short biography alone', () => {
    expect(trimBiography('Born in Concord. Acted a lot.')).toBe(
      'Born in Concord. Acted a lot.'
    )
    expect(trimBiography(undefined)).toBe('')
  })

  it('ends on a sentence rather than mid-attribution', () => {
    const bio = `${'He made a film. '.repeat(90)}${attribution}`
    const out = trimBiography(bio)
    expect(out.length).toBeLessThanOrEqual(1400)
    // The bug: the old word-boundary cut ended "...the Wikipedia article Tom…"
    expect(out).not.toMatch(/Wikipedia article Tom$/)
    expect(out.endsWith('.')).toBe(true)
  })

  it('prefers a paragraph break when there is one', () => {
    const bio = `${'A sentence about the work. '.repeat(45)}\n${'More prose. '.repeat(60)}`
    expect(trimBiography(bio)).not.toContain('\n')
  })

  it('falls back to a word boundary when nothing else fits', () => {
    const out = trimBiography('word '.repeat(400))
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/wor…$/)
  })
})
