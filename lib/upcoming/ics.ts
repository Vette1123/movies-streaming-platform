/**
 * A calendar file from a watchlist.
 *
 * Pure and separate from the panel that offers it, because iCalendar is a
 * format with real rules — folded lines, escaped text, exclusive end dates —
 * and every one of them fails silently: a malformed file does not error, it
 * simply imports nothing, or imports one event on the wrong day. That is the
 * kind of thing worth a test rather than a screenshot. See tests/upcoming.test.ts.
 */

export interface UpcomingItem {
  /** 'series:1399' / 'movie:550' — the watchlist's own key. */
  key: string
  name: string
  /** ISO date, no time: TMDB air dates carry neither a clock nor a zone. */
  date: string
  /** 'S08E01' for an episode, null for a film's release. */
  label: string | null
}

/**
 * RFC 5545 §3.3.11: a backslash, a comma and a semicolon are all delimiters in
 * a TEXT value, and a newline is written as a literal `\n`. A title like
 * "Fast, Furious" splits one SUMMARY into two properties without this.
 */
const escapeText = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

/**
 * RFC 5545 §3.1: no line over 75 octets. Continuations begin with one space.
 *
 * Counted in UTF-8 bytes rather than characters, and never split inside one —
 * a title with an accent or an em dash is common enough that a naive slice
 * would corrupt real files.
 */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line

  const decoder = new TextDecoder()
  const parts: string[] = []
  let start = 0
  // 75 on the first line, 74 on the rest — the leading space counts.
  let limit = 75

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    // Back off a continuation byte (10xxxxxx) so a multi-byte character is
    // never cut in half.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--
    }
    parts.push(decoder.decode(bytes.subarray(start, end)))
    start = end
    limit = 74
  }

  return parts.join('\r\n ')
}

/** YYYY-MM-DD to the DATE value form, or null if it is not a date. */
const compact = (date: string): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replace(/-/g, '') : null

/**
 * The day after, as a DATE value.
 *
 * DTEND on an all-day event is EXCLUSIVE (RFC 5545 §3.6.1), so an episode
 * airing on the 1st ends on the 2nd. Without this every event lands as a
 * zero-length block that some clients hide entirely.
 */
function nextDay(date: string): string | null {
  const stamp = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(stamp)) return null
  return compact(new Date(stamp + 86400000).toISOString().slice(0, 10))
}

const pathOf = (key: string): string => {
  const [kind, id] = key.split(':')
  return kind === 'series' ? `/tv-shows/${id}` : `/movies/${id}`
}

const summaryOf = (item: UpcomingItem): string =>
  item.label ? `${item.name} — ${item.label}` : `${item.name} (release day)`

const isSeries = (key: string): boolean => key.startsWith('series:')

/**
 * How long before it airs to nudge somebody.
 *
 * DTSTART is a DATE, which a client reads as midnight local. Fifteen hours
 * earlier is 09:00 the previous day — a civil hour, the day before, in whatever
 * zone the calendar is being read in, with no timezone data in the file at all.
 *
 * One alarm, not two. A calendar that fires twice per episode gets muted, and a
 * muted calendar is worth less than no calendar.
 */
const ALARM_TRIGGER = '-PT15H'

/**
 * The whole file.
 *
 * `stamp` is passed in rather than read from the clock so the output is a
 * function of its input, which is what makes it testable at all.
 */
export function buildIcs(
  items: UpcomingItem[],
  origin: string,
  stamp: number
): string {
  const dtstamp = `${new Date(stamp).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Reely//Watchlist//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Reely — coming up',
    'X-WR-CALDESC:Episodes and release days from your Reely watchlist.',
    // How often a client should come back. Both spellings: REFRESH-INTERVAL is
    // RFC 7986, X-PUBLISHED-TTL is what Outlook and Apple actually read. Without
    // either, clients pick their own interval — some poll every few minutes,
    // which is a Worker invocation each time for data that changes hourly at
    // best, and others go a whole day, which is too late for a premiere.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ]

  for (const item of items) {
    const start = compact(item.date)
    const end = start && nextDay(item.date)
    // A row the sweep has not dated yet, or dated badly. Skipped rather than
    // written half-formed: one broken VEVENT can take the whole import with it.
    if (!start || !end) continue

    lines.push(
      'BEGIN:VEVENT',
      // Stable across exports, so re-importing updates the event instead of
      // duplicating it. Keyed on the date too: a delayed episode is genuinely a
      // different occurrence, and leaving the old one behind would be a lie.
      `UID:reely-${item.key.replace(':', '-')}-${start}@reely.space`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeText(summaryOf(item))}`,
      // The link again, in the body. URL is not rendered by most clients, and
      // the whole point of the entry is to be one tap from the thing.
      `DESCRIPTION:${escapeText(`${item.name} — open in Reely: ${origin}${pathOf(item.key)}`)}`,
      `URL:${origin}${pathOf(item.key)}`,
      `CATEGORIES:${isSeries(item.key) ? 'TV' : 'Film'}`,
      // Nothing here is a commitment: an air date should never make somebody
      // look busy to their colleagues.
      'TRANSP:TRANSPARENT',
      'CLASS:PRIVATE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER;RELATED=START:${ALARM_TRIGGER}`,
      `DESCRIPTION:${escapeText(`Tomorrow: ${summaryOf(item)}`)}`,
      'END:VALARM',
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')

  // CRLF, not LF. Some clients accept bare newlines; Outlook is not one of them.
  return lines.map(foldLine).join('\r\n')
}
