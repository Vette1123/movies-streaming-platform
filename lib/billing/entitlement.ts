/**
 * Who is a supporter, and until when. The only place in the codebase that
 * decides.
 *
 * Kept pure and dependency-free so it can be exhaustively unit-tested: a bug
 * here either hands out paid features or takes them from someone who paid, and
 * neither shows up in a smoke test.
 */

/**
 * How long a failed payment keeps entitlement alive.
 *
 * A card that expired is the largest single cause of involuntary churn and is
 * not a decision to leave, so a `past_due` subscription keeps its features while
 * the provider retries. The cap is ours rather than the provider's, so that a
 * changed retry schedule or a webhook that never lands cannot mean unbounded
 * free service.
 */
export const PAST_DUE_GRACE_MS = 14 * 24 * 60 * 60 * 1000

/** The subset of the `users` row that entitlement depends on. */
export interface BillingRow {
  sub_status: string | null
  sub_ends_at: number | null
  sub_past_due_since: number | null
  /** Comma-separated set. See migration 0001 and `hasGrant`. */
  grants?: string | null
}

/**
 * A capability. Exactly one exists today, and the type is a union rather than
 * `string` so that adding a second one is a compile error at every reader
 * instead of a silent miss.
 */
export type Grant = 'pro'

/**
 * Exact membership in a comma-separated set, not a substring test.
 *
 * `includes('pro')` on the raw string would match any future grant that merely
 * contains those letters, which is the classic way a capability check starts
 * saying yes to things nobody granted.
 */
export function hasGrant(
  row: { grants?: string | null } | null,
  grant: Grant
): boolean {
  if (!row?.grants) return false
  return row.grants.split(',').some((name) => name.trim() === grant)
}

/** The stored set, trimmed and de-duplicated, in the order it was written. */
function grantSet(current: string | null | undefined): string[] {
  if (!current) return []
  const seen = new Set<string>()
  for (const name of current.split(',')) {
    const trimmed = name.trim()
    if (trimmed) seen.add(trimmed)
  }
  return [...seen]
}

/**
 * Add one grant, preserving every other one.
 *
 * Read-modify-write rather than `grants = 'pro'`, because the column is a set.
 * A writer that assigns the whole column detaches every other capability from an
 * account that had one, and nothing would report it. Typed as `string` rather
 * than `Grant` so the webhook can carry a name that came from configuration.
 */
export function withGrant(
  current: string | null | undefined,
  grant: string
): string {
  const names = grantSet(current)
  if (!names.includes(grant)) names.push(grant)
  return names.join(',')
}

/** Remove one grant, preserving every other one. Null when nothing is left. */
export function withoutGrant(
  current: string | null | undefined,
  grant: string
): string | null {
  const names = grantSet(current).filter((name) => name !== grant)
  return names.length > 0 ? names.join(',') : null
}

/**
 * Whether a period the customer has already paid for is still running. Shared
 * with the plan card so "is still entitled" and "still reads as entitled on
 * screen" cannot drift apart.
 */
export function paidThrough(endsAt: number | null, now: number): boolean {
  return endsAt !== null && now < endsAt
}

/**
 * What a SUBSCRIPTION entitles, ignoring hand grants.
 *
 * A `switch` rather than chained ternaries, and an explicit `default: false`, so
 * a status added later fails closed instead of matching some broader condition
 * by accident.
 */
export function isProAt(row: BillingRow | null, now: number): boolean {
  if (!row?.sub_status) return false

  switch (row.sub_status) {
    case 'active':
    case 'trialing':
      return true

    // Both spellings of "cancelled" keep the features to the end of the period
    // already paid for. Cutting someone off the moment they click cancel is
    // charging for service and not delivering it. This is also the status a
    // one-off coffee is converted into by hand — `canceled` plus a future
    // `sub_ends_at` is exactly "paid through this date, then stops".
    case 'scheduled_cancel':
    case 'canceled':
      return paidThrough(row.sub_ends_at, now)

    // A null start means the transition was never observed, so there is no
    // window to measure. Fail closed rather than grant an unbounded grace.
    case 'past_due':
      return (
        row.sub_past_due_since !== null &&
        now < row.sub_past_due_since + PAST_DUE_GRACE_MS
      )

    // `expired`, `unpaid`, `paused` — all stopped with nothing left paid for,
    // all failing by falling through rather than by being listed, so a new
    // stopped-ish status lands on the safe side too.
    default:
      return false
  }
}

/**
 * Whether this account gets supporter features right now, from any source.
 *
 * Deliberately separate from `isProAt`: that one answers "what does this
 * subscription entitle", which is the question the billing code asks when
 * deciding whether an event may supersede stored state. A hand grant is not a
 * subscription and must not be able to answer it.
 *
 * In practice today this is the grant alone — Buy Me a Coffee writes grants, not
 * subscriptions — and the subscription arm costs one call.
 */
export function isEntitled(row: BillingRow | null, now: number): boolean {
  return hasGrant(row, 'pro') || isProAt(row, now)
}
