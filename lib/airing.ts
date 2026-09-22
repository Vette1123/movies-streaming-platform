import { DAY_MS, localDayNumber } from '@/lib/local-day'
import { dateFormatter } from '@/lib/utils'

export interface AiringLabel {
  label: string
  /** Today / tomorrow — the chip is worth more attention. */
  urgent: boolean
}

/**
 * Label for an upcoming air date, or null when there is nothing worth a chip.
 *
 * Calendar days apart rather than a duration, and on the visitor's OWN
 * calendar: "today" is the day on their wall. Counting UTC days made a US
 * prime-time episode lose its chip at 8pm EDT, an hour before it aired, and
 * called tomorrow's episode "today" all evening. The chip is mount-gated, so
 * the server never has to agree with a zone it cannot know. The far-date
 * string still goes through the pinned `dateFormatter`.
 *
 * Past dates, empty strings and unparseable values all return null: a series
 * that has ended, or a bad payload, must not grow a chip that says "Airs
 * today" about something that already aired.
 */
export function airingLabel(
  airDate: string | null | undefined,
  now: number = Date.now(),
  offsetMinutes: number = new Date(now).getTimezoneOffset()
): AiringLabel | null {
  if (!airDate) return null
  const stamp = Date.parse(`${airDate.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(stamp)) return null

  const days = stamp / DAY_MS - localDayNumber(now, offsetMinutes)
  if (days < 0) return null
  if (days === 0) return { label: 'Airs today', urgent: true }
  if (days === 1) return { label: 'Airs tomorrow', urgent: true }
  if (days <= 7) return { label: `Airs in ${days} days`, urgent: false }
  return { label: `Airs ${dateFormatter(airDate, true)}`, urgent: false }
}
