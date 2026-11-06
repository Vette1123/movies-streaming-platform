import { withGrant } from '@/lib/billing/entitlement'

/**
 * Give an account whatever the supporters table already knows about its address.
 * Called on every sign-in, which is what closes the paid-first gap: Pro is
 * granted to an EMAIL (`pnpm pro <address>`), and the account holding that
 * address may not exist yet.
 *
 * Cheap enough to run unconditionally: one primary-key lookup that misses for
 * everyone who has never supported the project, and no write unless the set
 * actually changes.
 */
export async function claimSupporterGrants(
  db: D1Database,
  userId: string,
  email: string
): Promise<void> {
  const supporter = await db
    .prepare('SELECT grants FROM supporters WHERE email = ?')
    .bind(email.trim().toLowerCase())
    .first<{ grants: string }>()
  if (!supporter?.grants) return

  const user = await db
    .prepare('SELECT grants FROM users WHERE id = ?')
    .bind(userId)
    .first<{ grants: string | null }>()
  if (!user) return

  let next = user.grants ?? null
  for (const grant of supporter.grants.split(',')) {
    const name = grant.trim()
    if (name) next = withGrant(next, name)
  }
  if (next === user.grants) return

  await db
    .prepare('UPDATE users SET grants = ? WHERE id = ?')
    .bind(next, userId)
    .run()
}
