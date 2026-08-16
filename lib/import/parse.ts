/**
 * Reading someone else's library out of a CSV.
 *
 * The switching cost is the whole reason people stay where they are: a decade
 * of Letterboxd ratings or an IMDb watchlist is not something anybody retypes.
 * Both services export CSV, and both exports are small enough to parse in the
 * browser, so nothing here needs a server and no file is ever uploaded
 * anywhere — the parsing happens on the device and only the titles that need a
 * TMDB id are ever sent, without ratings attached.
 *
 * Pure and tested, because the failure mode is silent and awful: a column read
 * from the wrong index imports 800 rows of nonsense into somebody's library,
 * and the sync engine then copies it to all their devices.
 */

export type ImportKind = 'imdb' | 'letterboxd' | 'unknown'

export interface ImportRow {
  /** 'tt0133093' when the export carries one — an exact TMDB match. */
  imdb: string | null
  title: string
  year: number | null
  /** Out of ten, on Reely's scale, or null when the export has no rating. */
  rating: number | null
}

export interface ParsedImport {
  kind: ImportKind
  rows: ImportRow[]
  /** Rows that had no usable title at all, counted so the UI can be honest. */
  skipped: number
}

/**
 * RFC 4180 enough for the two files this has to read.
 *
 * Quoted fields, doubled quotes inside them, and commas and newlines inside
 * quotes. Written out rather than pulled in as a dependency: this is thirty
 * lines, and a film called "Lock, Stock and Two Smoking Barrels" is exactly the
 * case a naive `split(',')` gets wrong on row one.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  // A BOM at the start of the file becomes part of the first header name and
  // breaks every column lookup. Excel writes one; both exports can have been
  // through Excel.
  const input = text.replace(/^﻿/, '')

  for (let index = 0; index < input.length; index++) {
    const char = input[index]

    if (quoted) {
      if (char !== '"') {
        field += char
        continue
      }
      if (input[index + 1] === '"') {
        field += '"'
        index++
        continue
      }
      quoted = false
      continue
    }

    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\r') continue
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += char
  }

  // Whatever is still in hand when the file ends is the last field of the last
  // row — an export without a trailing newline is common and must not lose one.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

/** Case- and space-insensitive column lookup, since headers vary by export version. */
function columnIndex(header: string[], ...names: string[]): number {
  const normalised = header.map((value) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ')
  )
  for (const name of names) {
    const index = normalised.indexOf(name.toLowerCase())
    if (index >= 0) return index
  }
  return -1
}

const IMDB_ID = /^tt\d{7,}$/i

const cell = (row: string[], index: number): string =>
  index >= 0 ? (row[index] ?? '').trim() : ''

/** A four-digit year out of '1999', '1999-10-15' or 'Fight Club (1999)'. */
function yearOf(value: string): number | null {
  const match = value.match(/(\d{4})/)
  if (!match) return null
  const year = Number(match[1])
  return year >= 1870 && year <= 2100 ? year : null
}

/**
 * Which service wrote this file.
 *
 * By its columns rather than its filename: people rename downloads, and both
 * services call the file something generic.
 */
export function detectKind(header: string[]): ImportKind {
  if (columnIndex(header, 'const') >= 0) return 'imdb'
  if (
    columnIndex(header, 'letterboxd uri') >= 0 ||
    (columnIndex(header, 'name') >= 0 && columnIndex(header, 'year') >= 0)
  ) {
    return 'letterboxd'
  }
  return 'unknown'
}

/**
 * Letterboxd scores out of five, in halves. Doubling puts them on the ten-point
 * scale everything else here uses, and a 4.5 becomes a 9 rather than being
 * rounded to something the person never gave it.
 */
const letterboxdRating = (value: string): number | null => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.min(10, Math.round(parsed * 2 * 10) / 10)
}

const imdbRating = (value: string): number | null => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) return null
  return Math.round(parsed * 10) / 10
}

/**
 * A CSV from either service, as rows this app can act on.
 *
 * Anything without a title is dropped and counted rather than imported as a
 * blank, and a row is never invented from a column that is missing.
 */
export function parseImport(text: string): ParsedImport {
  const table = parseCsv(text)
  if (table.length < 2) return { kind: 'unknown', rows: [], skipped: 0 }

  const header = table[0]
  const kind = detectKind(header)
  if (kind === 'unknown') return { kind, rows: [], skipped: 0 }

  const idAt = columnIndex(header, 'const', 'imdb id')
  const titleAt = columnIndex(header, 'title', 'name', 'original title')
  const yearAt = columnIndex(header, 'year', 'release date', 'year released')
  const ratingAt = columnIndex(header, 'your rating', 'rating')

  const rows: ImportRow[] = []
  let skipped = 0

  for (const entry of table.slice(1)) {
    const title = cell(entry, titleAt)
    const rawId = cell(entry, idAt)
    const imdb = IMDB_ID.test(rawId) ? rawId.toLowerCase() : null

    if (!title && !imdb) {
      skipped++
      continue
    }

    const rawRating = cell(entry, ratingAt)
    rows.push({
      imdb,
      title,
      year: yearOf(cell(entry, yearAt)),
      rating:
        kind === 'imdb' ? imdbRating(rawRating) : letterboxdRating(rawRating),
    })
  }

  return { kind, rows, skipped }
}
