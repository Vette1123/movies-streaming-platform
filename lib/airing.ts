import { dateFormatter } from '@/lib/utils'

const DAY_MS = 86_400_000

export interface AiringLabel {
  label: string
  /** Today / tomorrow — the chip is worth more attention. */
  urgent: boolean
}

/** UTC midnight of the calendar day `now` falls on. */
function startOfUtcDay(now: number): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * Label for an upcoming air date, or null when there is nothing worth a chip.
 *
 * Days apart rather than a duration: both sides are floored to UTC midnight
 * first, so an episode airing in six hours reads "Airs today" if that is the
 * day it is on — same rule as the upcoming panel's `whenLabel`. TMDB calendar
 * dates are date-only; pinning to UTC matches `dateFormatter` and keeps the
 * string identical on server and client (the chip itself is mount-gated).
 *
 * Past dates, empty strings and unparseable values all return null: a series
 * that has ended, or a bad payload, must not grow a chip that says "Airs
 * today" about something that already aired.
 */
export function airingLabel(
  airDate: string | null | undefined,
  now: number = Date.now()
): AiringLabel | null {
  if (!airDate) return null
  const stamp = Date.parse(`${airDate.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(stamp)) return null

  const days = Math.round((stamp - startOfUtcDay(now)) / DAY_MS)
  if (days < 0) return null
  if (days === 0) return { label: 'Airs today', urgent: true }
  if (days === 1) return { label: 'Airs tomorrow', urgent: true }
  if (days <= 7) return { label: `Airs in ${days} days`, urgent: false }
  return { label: `Airs ${dateFormatter(airDate, true)}`, urgent: false }
}
