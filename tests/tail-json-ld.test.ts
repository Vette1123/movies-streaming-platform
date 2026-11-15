import { describe, expect, it } from 'vitest'

import { tailTitleJsonLd } from '@/lib/json-ld'
import { movieJsonLd, tvSeriesJsonLd } from '@/lib/structured-data'

const SITE = 'https://www.reely.space'

// A tail id (served by the Worker) and a prerendered id must describe the
// same entity with the same properties. They drifted once: the Worker's
// TVSeries carried `datePublished`, no `startDate`, no `@id`, no `inLanguage`.
const PARITY_KEYS = [
  '@type',
  '@id',
  'url',
  'name',
  'inLanguage',
  'datePublished',
  'dateCreated',
  'startDate',
  'genre',
  'sameAs',
]

const pick = (node: Record<string, unknown>) =>
  Object.fromEntries(PARITY_KEYS.map((key) => [key, node[key]]))

describe('tail-id title JSON-LD', () => {
  it('a movie matches the prerendered Movie node', () => {
    const tail = tailTitleJsonLd({
      type: 'movie',
      id: 550,
      name: 'Fight Club',
      canonical: `${SITE}/movies/550`,
      description: 'An insomniac office worker starts a fight club.',
      genres: ['Drama'],
      released: '1999-10-15',
      originalLanguage: 'en',
      imdbId: 'tt0137523',
    })
    const baked = movieJsonLd({
      id: 550,
      title: 'Fight Club',
      releaseDate: '1999-10-15',
      genres: ['Drama'],
      originalLanguage: 'en',
      imdbId: 'tt0137523',
    })
    expect(pick(tail)).toEqual(pick(baked))
    expect(tail.dateCreated).toBe('1999-10-15')
  })

  it('a series uses startDate, its own @id and its own language', () => {
    const tail = tailTitleJsonLd({
      type: 'tv',
      id: 1396,
      name: 'Breaking Bad',
      canonical: `${SITE}/tv-shows/1396`,
      description: 'A chemistry teacher turns to making meth.',
      genres: ['Drama'],
      released: '2008-01-20',
      originalLanguage: 'en',
    })
    const baked = tvSeriesJsonLd({
      id: 1396,
      name: 'Breaking Bad',
      firstAirDate: '2008-01-20',
      genres: ['Drama'],
      originalLanguage: 'en',
    })
    expect(pick(tail)).toEqual(pick(baked))
    expect(tail.startDate).toBe('2008-01-20')
    expect(tail.datePublished).toBeUndefined()
  })

  it('files a non-English title under its own language', () => {
    const tail = tailTitleJsonLd({
      type: 'movie',
      id: 129,
      name: 'Spirited Away',
      canonical: `${SITE}/movies/129`,
      description: 'A girl wanders into a world of spirits.',
      originalLanguage: 'ja',
    })
    expect(tail.inLanguage).toBe('ja')
  })
})
