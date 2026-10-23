// What belongs on the error board — pure, so tests/board-filters.test.ts pins
// it. Ported from masareef/rafiq: every hiding rule has a name, and the board
// prints how many rows each one hid, because a board that silently drops rows
// cannot be told apart from a broken query.

/**
 * HogQL returns array and object properties as JSON TEXT, not values —
 * `$exception_types` arrives as '["Error"]'. Parse what looks like JSON.
 */
export function parseJsonish(value) {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text.startsWith('[') && !text.startsWith('{')) return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

/** First element of a (possibly JSON-text) array property. */
export function firstOf(value) {
  const parsed = parseJsonish(value)
  return (Array.isArray(parsed) ? parsed[0] : parsed) ?? ''
}

/** PostHog statuses that mean "somebody already decided". */
const CLOSED = new Set(['resolved', 'suppressed', 'archived', 'merged'])

/**
 * A web build has no version a phone can be stuck on, but a tab can be: an
 * open tab keeps running the old bundle until it reloads. A day covers that,
 * then a fresh event after the fix is a regression and shows again.
 */
export const FIX_GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Why a grouped issue is hidden, or null if it belongs on the board.
 *
 *   row     — { id, last_seen }  (last_seen: ISO string)
 *   status  — PostHog status for the id, or undefined if it has none yet
 *   ledger  — scripts/posthog-fixed.json: { [id]: { fixedOn: 'YYYY-MM-DD', … } }
 */
export function hiddenBecause(row, status, ledger) {
  if (status && CLOSED.has(status)) return status
  const fixed = ledger[row.id]
  if (fixed?.fixedOn) {
    const cutoff = Date.parse(`${fixed.fixedOn}T00:00:00Z`) + FIX_GRACE_MS
    if (Date.parse(row.last_seen) < cutoff) return 'fixed-in-ledger'
  }
  return null
}

/** Split rows into what shows and a count per hiding reason. */
export function boardRows(rows, statuses, ledger) {
  const shown = []
  const hidden = {}
  for (const row of rows) {
    const reason = hiddenBecause(row, statuses.get(row.id), ledger)
    if (reason) hidden[reason] = (hidden[reason] ?? 0) + 1
    else shown.push(row)
  }
  return { shown, hidden }
}

/**
 * The in-app frames of an $exception_list, newest first, as `file:line fn`.
 * Our code is whatever is served from /_next/; everything else is a browser
 * extension or an injected script (see lib/error-noise.ts).
 */
export function ownFrames(exceptionList, limit = 6) {
  const frames = []
  const list = parseJsonish(exceptionList)
  for (const exception of Array.isArray(list) ? list : []) {
    const stack = exception?.stacktrace?.frames ?? []
    for (const frame of [...stack].reverse()) {
      const file = String(
        frame.source ?? frame.filename ?? frame.abs_path ?? ''
      )
      if (!file.includes('/_next/') && frame.in_app !== true) continue
      const name = frame.resolved_name ?? frame.mangled_name ?? frame.function
      frames.push(
        `${file.replace(/^.*\/_next\//, '_next/')}:${frame.line ?? '?'} ${name ?? ''}`.trim()
      )
      if (frames.length >= limit) return frames
    }
  }
  return frames
}
