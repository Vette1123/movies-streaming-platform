import { describe, expect, it } from 'vitest'

import { buildIcs, foldLine, type UpcomingItem } from '@/lib/upcoming/ics'

/**
 * iCalendar fails silently. A malformed file does not error — a calendar client
 * imports nothing, or imports one event on the wrong day, and nobody finds out
 * until the episode has already aired. So the rules that are easy to get wrong
 * (exclusive end dates, escaped delimiters, folded lines) are pinned here.
 */
const STAMP = Date.parse('2026-08-16T10:30:00Z')
const ORIGIN = 'https://www.reely.space'

const item = (over: Partial<UpcomingItem> = {}): UpcomingItem => ({
  key: 'series:1399',
  name: 'Game of Thrones',
  date: '2026-09-01',
  label: 'S08E01',
  ...over,
})

const build = (items: UpcomingItem[]) => buildIcs(items, ORIGIN, STAMP)

describe('buildIcs', () => {
  it('writes one all-day event that ends the following day', () => {
    const ics = build([item()])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260901')
    // Exclusive per RFC 5545 §3.6.1 — the same date on both would be a
    // zero-length event some clients hide entirely.
    expect(ics).toContain('DTEND;VALUE=DATE:20260902')
    expect(ics).toContain('SUMMARY:Game of Thrones — S08E01')
    expect(ics).toContain('URL:https://www.reely.space/tv-shows/1399')
  })

  it('carries one alarm per event, the morning before', () => {
    const ics = build([item()])
    // 15h before midnight-local is 09:00 the previous day, in whatever zone the
    // calendar is read in — no VTIMEZONE needed.
    expect(ics).toContain('TRIGGER;RELATED=START:-PT15H')
    // Exactly one. A calendar that fires twice per episode gets muted.
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(1)
    expect(ics.match(/END:VALARM/g)).toHaveLength(1)
    expect(ics).toContain('DESCRIPTION:Tomorrow: Game of Thrones — S08E01')
  })

  it('tells the client how often to come back', () => {
    const ics = build([])
    // Both spellings: RFC 7986 for anything modern, the X- property for Outlook
    // and Apple, which read that one instead.
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT6H')
    expect(ics).toContain('X-PUBLISHED-TTL:PT6H')
  })

  it('categorises by media type and keeps the entry private and free', () => {
    expect(build([item()])).toContain('CATEGORIES:TV')
    const film = build([item({ key: 'movie:550', label: null })])
    expect(film).toContain('CATEGORIES:Film')
    expect(film).toContain('CLASS:PRIVATE')
    expect(film).toContain('TRANSP:TRANSPARENT')
  })

  it('rolls the end date over a month boundary', () => {
    expect(build([item({ date: '2026-08-31' })])).toContain(
      'DTEND;VALUE=DATE:20260901'
    )
  })

  it('names a film by its release day and links it as a film', () => {
    const ics = build([
      item({ key: 'movie:550', name: 'Fight Club', label: null }),
    ])
    expect(ics).toContain('SUMMARY:Fight Club (release day)')
    expect(ics).toContain('URL:https://www.reely.space/movies/550')
  })

  it('escapes the delimiters that would split one property into two', () => {
    const ics = build([item({ name: 'Fast, Furious; and\\back', label: null })])
    expect(ics).toContain(
      'SUMMARY:Fast\\, Furious\\; and\\\\back (release day)'
    )
  })

  it('gives an event a UID that is stable per date and unique per title', () => {
    expect(build([item()])).toContain(
      'UID:reely-series-1399-20260901@reely.space'
    )
    // A delayed episode is a different occurrence, not an edit of the old one.
    expect(build([item({ date: '2026-09-08' })])).toContain(
      'UID:reely-series-1399-20260908@reely.space'
    )
  })

  it('skips a row it cannot date rather than writing half an event', () => {
    const ics = build([item({ date: 'soon' }), item()])
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).not.toContain('soon')
  })

  it('is still a valid empty calendar with nothing to say', () => {
    const ics = build([])
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('uses CRLF, which Outlook requires', () => {
    expect(build([item()])).toContain('\r\n')
  })
})

describe('foldLine', () => {
  it('leaves a short line alone', () => {
    expect(foldLine('SUMMARY:Dune')).toBe('SUMMARY:Dune')
  })

  it('folds a long line with a leading space on the continuation', () => {
    const folded = foldLine(`SUMMARY:${'a'.repeat(200)}`)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.slice(1).every((part) => part.startsWith(' '))).toBe(true)
    // Every emitted line is inside the 75-octet limit, counting the fold space.
    for (const [index, part] of parts.entries()) {
      const octets = new TextEncoder().encode(part).length
      expect(octets).toBeLessThanOrEqual(index === 0 ? 75 : 75)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'a'.repeat(200)}`)
  })

  it('never cuts a multi-byte character in half', () => {
    const line = `SUMMARY:${'é'.repeat(80)}`
    const folded = foldLine(line)
    expect(folded).not.toContain('�')
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })
})
