/**
 * The same watchlist schedule, as a feed.
 *
 * A calendar answers "what day is it on"; a feed answers "tell me when there is
 * something". They are different questions and different apps, and the data
 * behind both is the one JOIN in ./routes.ts — so this is a second renderer, not
 * a second feature. Same token, same rows, no extra query.
 *
 * RSS 2.0 rather than Atom: every reader handles it, and the one thing that
 * matters here — a stable `guid` so an item is never announced twice — is
 * simpler in it. Pure and separate from the route for the same reason as
 * ./ics.ts: malformed XML fails silently in readers, and that is worth a test.
 * See tests/upcoming.test.ts.
 */

import type { UpcomingItem } from './ics'

/**
 * The five characters XML cares about, in the one order that is safe.
 *
 * `&` first, or the escapes introduced by the later replacements are themselves
 * escaped. Titles with an ampersand are common enough that this is not
 * hypothetical.
 */
const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const pathOf = (key: string): string => {
  const [kind, id] = key.split(':')
  return kind === 'series' ? `/tv-shows/${id}` : `/movies/${id}`
}

const titleOf = (item: UpcomingItem): string =>
  item.label ? `${item.name} — ${item.label}` : `${item.name} (release day)`

/**
 * RFC 822, which is what RSS `pubDate` is.
 *
 * Written out rather than taken from `toUTCString()`, which is close but not
 * guaranteed by spec to be this format. A date the reader cannot parse silently
 * becomes "now", and every item in the feed jumps to the top on every poll.
 */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function rfc822(stamp: number): string {
  const date = new Date(stamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${DAYS[date.getUTCDay()]}, ${pad(date.getUTCDate())} ` +
    `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT`
  )
}

/**
 * The whole document.
 *
 * `stamp` is passed in rather than read from the clock, so the output is a
 * function of its input and can be asserted on.
 *
 * Items are dated by AIR DAY, not by when the row was written. A feed reader
 * sorts and marks-as-new by `pubDate`, so this is what makes the next episode
 * arrive at the top on the morning it airs rather than whenever the sweep last
 * touched the row.
 */
export function buildRss(
  items: UpcomingItem[],
  origin: string,
  stamp: number,
  selfPath: string
): string {
  // The reader's own URL, token and all. It already has it — that is how it got
  // here — and a self link that points somewhere else is what makes a reader
  // silently stop following the feed after a move.
  const self = `${origin}${selfPath}`

  const entries = items
    .map((item) => {
      const airs = Date.parse(`${item.date}T09:00:00Z`)
      if (!Number.isFinite(airs)) return ''
      const link = `${origin}${pathOf(item.key)}`
      const when = item.label ? 'airs' : 'is out'
      return [
        '    <item>',
        `      <title>${escapeXml(titleOf(item))}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        // Not a URL, and said so: the link changes if a title moves, and a
        // reader keyed on it would re-announce every item when it did.
        `      <guid isPermaLink="false">reely:${escapeXml(item.key)}:${item.date}</guid>`,
        `      <pubDate>${rfc822(airs)}</pubDate>`,
        `      <description>${escapeXml(`${item.name} ${when} on ${item.date}.`)}</description>`,
        '    </item>',
      ].join('\n')
    })
    .filter(Boolean)
    .join('\n')

  return (
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '  <channel>',
      '    <title>Reely — coming up</title>',
      `    <link>${escapeXml(origin)}/account#upcoming</link>`,
      '    <description>Episodes and release days from your Reely watchlist.</description>',
      '    <language>en</language>',
      `    <lastBuildDate>${rfc822(stamp)}</lastBuildDate>`,
      // Readers poll on their own schedule; this is the only hint the format has,
      // and without it some come back every few minutes for data the sweep
      // refreshes hourly at best. Each poll is a Worker invocation.
      '    <ttl>360</ttl>',
      `    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />`,
      entries,
      '  </channel>',
      '</rss>',
    ]
      // Drops the entries block when the feed is empty, rather than leaving a
      // blank line where the items would be.
      .filter((line) => line !== '')
      .join('\n')
  )
}
