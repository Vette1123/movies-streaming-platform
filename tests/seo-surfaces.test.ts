import { describe, expect, it } from 'vitest'

import type { Credit } from '@/types/credit'
import { castNames, crewNamesByJob } from '@/lib/credits'
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
