import { describe, expect, it } from 'vitest'

import { detectKind, parseCsv, parseImport } from '@/lib/import/parse'

/**
 * The failure mode here is silent and expensive: a column read from the wrong
 * index imports hundreds of wrong rows into somebody's library, and the sync
 * engine then copies that to every device they own. So the parser is pinned
 * against the real shape of both exports.
 */

const IMDB = [
  'Const,Your Rating,Date Rated,Title,Title Type,IMDb Rating,Year',
  'tt0137523,9,2024-01-02,Fight Club,movie,8.8,1999',
  'tt0903747,10,2024-02-11,"Breaking Bad",tvSeries,9.5,2008',
].join('\n')

const LETTERBOXD = [
  'Date,Name,Year,Letterboxd URI,Rating',
  '2024-03-01,Heat,1995,https://boxd.it/x,4.5',
  '2024-03-02,"Lock, Stock and Two Smoking Barrels",1998,https://boxd.it/y,3',
].join('\n')

describe('parseCsv', () => {
  it('keeps a comma that is inside a quoted field', () => {
    const rows = parseCsv('a,b\n"Lock, Stock",2')
    expect(rows[1]).toEqual(['Lock, Stock', '2'])
  })

  it('handles a doubled quote inside a quoted field', () => {
    expect(parseCsv('a\n"He said ""hi"""')[1]).toEqual(['He said "hi"'])
  })

  it('keeps a newline that is inside a quoted field', () => {
    expect(parseCsv('a,b\n"two\nlines",x')[1]).toEqual(['two\nlines', 'x'])
  })

  it('keeps the last row when the file has no trailing newline', () => {
    expect(parseCsv('a,b\n1,2')).toHaveLength(2)
  })

  it('strips a BOM, which would otherwise corrupt the first header', () => {
    expect(parseCsv('﻿Const,Title')[0][0]).toBe('Const')
  })
})

describe('detectKind', () => {
  it('recognises both exports by their columns, not their filename', () => {
    expect(detectKind(['Const', 'Title'])).toBe('imdb')
    expect(detectKind(['Date', 'Name', 'Year', 'Letterboxd URI'])).toBe(
      'letterboxd'
    )
    expect(detectKind(['a', 'b'])).toBe('unknown')
  })
})

describe('parseImport', () => {
  it('reads an IMDb export, ids and ten-point ratings intact', () => {
    const { kind, rows } = parseImport(IMDB)
    expect(kind).toBe('imdb')
    expect(rows[0]).toEqual({
      imdb: 'tt0137523',
      title: 'Fight Club',
      year: 1999,
      rating: 9,
    })
    expect(rows[1].imdb).toBe('tt0903747')
  })

  it('doubles a Letterboxd five-point rating onto the ten-point scale', () => {
    const { kind, rows } = parseImport(LETTERBOXD)
    expect(kind).toBe('letterboxd')
    // 4.5 out of 5 is a 9, not a rounded 8 or 10.
    expect(rows[0].rating).toBe(9)
    expect(rows[1].rating).toBe(6)
    // And the comma in the title survived.
    expect(rows[1].title).toBe('Lock, Stock and Two Smoking Barrels')
  })

  it('has no rating for a watchlist export, which is what routes it', () => {
    const rows = parseImport('Date,Name,Year\n2024-01-01,Dune,2021\n').rows
    expect(rows[0].rating).toBeNull()
    expect(rows[0].year).toBe(2021)
  })

  it('counts rows with no title instead of importing blanks', () => {
    const parsed = parseImport(
      'Const,Title,Year\n,,1999\ntt0137523,Fight Club,1999'
    )
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.skipped).toBe(1)
  })

  it('ignores a malformed id rather than sending it to TMDB', () => {
    const parsed = parseImport('Const,Title,Year\nnot-an-id,Dune,2021')
    expect(parsed.rows[0].imdb).toBeNull()
    expect(parsed.rows[0].title).toBe('Dune')
  })

  it('reads a year out of a full release date', () => {
    const parsed = parseImport('Const,Title,Release Date\ntt1,Dune,2021-10-22')
    expect(parsed.rows[0].year).toBe(2021)
  })

  it('returns nothing for a file that is not either export', () => {
    expect(parseImport('one,two\n1,2').rows).toEqual([])
    expect(parseImport('').rows).toEqual([])
  })
})
