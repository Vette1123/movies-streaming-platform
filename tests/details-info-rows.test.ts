import { describe, expect, it } from 'vitest'

import type { MovieDetails } from '@/types/movie-details'
import type { SeriesDetails } from '@/types/series-details'
import { personSearchHref } from '@/lib/constants'
import {
  filledInfoRows,
  movieExtraInfoFormatter,
  seriesExtraInfoFormatter,
} from '@/components/media/extra-info'

const names = (rows: { name: string }[]) => rows.map((row) => row.name)

describe('detail page info rows', () => {
  it('a movie with no director has no Director link to a search for "undefined"', () => {
    const rows = movieExtraInfoFormatter(
      { runtime: 120, status: 'Released' } as MovieDetails,
      undefined
    )
    expect(names(rows)).not.toContain('Director')
  })

  it('a running show drops its null last air date and empty country list', () => {
    const rows = filledInfoRows(
      seriesExtraInfoFormatter(
        {
          first_air_date: '2024-01-01',
          last_air_date: null,
          origin_country: [],
          status: 'Returning Series',
          number_of_seasons: 2,
        } as unknown as SeriesDetails,
        undefined
      )
    )
    expect(names(rows)).not.toContain('Last Air Date')
    expect(names(rows)).not.toContain('Original Country')
    expect(names(rows)).toContain('Number of Seasons')
  })

  it('keeps a zero count but drops blank strings', () => {
    expect(
      filledInfoRows([
        { name: 'a', value: 0 },
        { name: 'b', value: '  ' },
        { name: 'c', value: 'x' },
      ])
    ).toEqual([
      { name: 'a', value: 0 },
      { name: 'c', value: 'x' },
    ])
  })

  it('encodes the name in a person search link', () => {
    expect(personSearchHref('Simon & Garfunkel')).toMatch(
      /Simon%20%26%20Garfunkel$/
    )
  })
})
