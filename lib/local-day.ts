export const DAY_MS = 86_400_000

/**
 * The visitor's LOCAL calendar day, as a day number (days since the epoch).
 *
 * UTC days roll over at 17:00 in California and 03:00 in Cairo — mid-evening
 * for somebody, which is exactly when "tonight" and "airs today" get read.
 * `offsetMinutes` is `getTimezoneOffset()`'s sign (minutes BEHIND UTC) and is
 * injectable so tests do not depend on the machine's zone. Only call this
 * after mount: the server's zone is not the visitor's.
 */
export function localDayNumber(
  now: number = Date.now(),
  offsetMinutes: number = new Date(now).getTimezoneOffset()
): number {
  return Math.floor((now - offsetMinutes * 60_000) / DAY_MS)
}
