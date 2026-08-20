/**
 * When not to ring.
 *
 * The whole feature rests on something the alert system already does: a push
 * carries no payload, it only wakes the device, and what to show is queued in
 * `notifications` and fetched afterwards. So being quiet does not mean losing an
 * alert — the row is written either way. It means the phone does not buzz at
 * 3am, and the alert is sitting there in the morning.
 *
 * Everything here is pure. Time-of-day logic that wraps past midnight and lands
 * in the user's zone rather than the Worker's is the kind of thing that is
 * wrong for a fortnight before anybody notices, and it cannot be checked in a
 * browser. See tests/quiet-hours.test.ts.
 */

export interface QuietHours {
  /** Local hour the quiet window opens, 0-23. */
  from: number
  /** Local hour it closes, 0-23. Equal to `from` means the whole day. */
  to: number
  /**
   * Minutes to ADD to UTC to reach their local time — the negation of
   * `Date.prototype.getTimezoneOffset`, which counts the other way. Stored
   * rather than a zone name because the Worker has no tz database, and a fixed
   * offset is honest about what it is: right for eleven months, an hour out for
   * one, and the wrong hour to be woken is 3am, not 3:59am.
   */
  tz: number
}

/** Ring at most once a day, instead of once per thing that happens. */
export const DIGEST_GAP_MS = 20 * 60 * 60 * 1000

const clampHour = (value: unknown): number | null => {
  // typeof, not coercion: these two numbers are done arithmetic on every sweep,
  // and a quiet window stored as strings is a bug that only shows up at 3am.
  if (typeof value !== 'number') return null
  const hour = Number(value)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  return hour
}

/** ±14h is the real range of civil offsets; anything else is a bad client. */
const clampOffset = (value: unknown): number => {
  const minutes = Number(value)
  if (!Number.isFinite(minutes)) return 0
  return Math.max(-14 * 60, Math.min(14 * 60, Math.round(minutes)))
}

/**
 * A quiet window off a prefs blob, or null if there is not one.
 *
 * `from === to` is rejected rather than read as "always quiet": somebody who
 * wants no alerts turns alerts off, and a window that silences everything
 * forever is far more likely to be a slider that slipped.
 */
export function normaliseQuietHours(value: unknown): QuietHours | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const from = clampHour(input.from)
  const to = clampHour(input.to)
  if (from === null || to === null || from === to) return null
  return { from, to, tz: clampOffset(input.tz) }
}

/** Their local hour, right now. */
export function localHour(quiet: QuietHours, now: number): number {
  const shifted = new Date(now + quiet.tz * 60_000)
  return shifted.getUTCHours()
}

/**
 * Is it quiet for this person at this instant?
 *
 * The window wraps: 22 to 7 is nine hours across midnight, not the fifteen
 * hours between them. That inversion is the entire reason this is a function
 * and not a comparison written inline at the call site.
 */
export function isQuiet(quiet: QuietHours | null, now: number): boolean {
  if (!quiet) return false
  const hour = localHour(quiet, now)
  if (quiet.from < quiet.to) return hour >= quiet.from && hour < quiet.to
  return hour >= quiet.from || hour < quiet.to
}

/**
 * Should this account's devices ring right now?
 *
 * Two separate reasons not to, and they compose: quiet hours are about the
 * clock, the digest is about how often. Neither drops the notification — both
 * only decide whether the phone makes a noise.
 */
export function shouldRing(
  options: {
    quiet: QuietHours | null
    digest: boolean
    lastPushAt: number | null
  },
  now: number
): boolean {
  if (isQuiet(options.quiet, now)) return false
  if (options.digest && options.lastPushAt !== null) {
    return now - options.lastPushAt >= DIGEST_GAP_MS
  }
  return true
}
