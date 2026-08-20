/**
 * Handing somebody a stretch of supporter time.
 *
 * Two features arrive at the same place — a gift code somebody redeems, and the
 * free month a referrer earns — so the "how" is written once. Neither is a
 * subscription: nothing recurs, nothing is charged, and no processor knows about
 * it. What they are is the shape `isProAt` already understands as "paid through
 * this date, then stops": status `canceled`, plus a future `sub_ends_at`.
 *
 * The important property is that it EXTENDS rather than sets. Two gift codes,
 * or a gift on top of a month already running, has to add up — anything else
 * silently throws away time somebody was given.
 */

/**
 * A month, as a fixed span.
 *
 * Thirty days rather than calendar arithmetic. Nobody is billed on this, so
 * "the 31st in a month with 30 days" is a question worth not having, and the
 * difference is always in the recipient's favour twice a year.
 */
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/** How far a stretch of months reaches, from now or from what is already paid. */
export function extendedEnd(
  currentEnd: number | null,
  months: number,
  now: number
): number {
  const from = currentEnd !== null && currentEnd > now ? currentEnd : now
  return from + months * MONTH_MS
}

/**
 * Give this account `months` of supporter, on top of anything it already has.
 *
 * `sub_updated_at` is stamped because the webhook uses it as a replay guard —
 * a grant written here must not look older than an event that arrives later and
 * knows nothing about it.
 */
export async function grantMonths(
  db: D1Database,
  userId: string,
  months: number,
  now: number
): Promise<number> {
  const row = await db
    .prepare('SELECT sub_ends_at FROM users WHERE id = ?')
    .bind(userId)
    .first<{ sub_ends_at: number | null }>()

  const endsAt = extendedEnd(row?.sub_ends_at ?? null, months, now)

  await db
    .prepare(
      `UPDATE users
       SET sub_status = 'canceled', sub_variant = 'monthly',
           sub_ends_at = ?, sub_updated_at = ?
       WHERE id = ?`
    )
    .bind(endsAt, now, userId)
    .run()

  return endsAt
}
