/**
 * Gifting a month of supporter, and earning one by bringing somebody in.
 *
 * Both are the same transaction seen from two sides: an account spends
 * something to put time on another account. A gift is deliberate — a supporter
 * mints a code and sends it. A referral is automatic — somebody signs up from
 * your invite link (or your public page), and at REFERRALS_PER_MONTH of them
 * you get a month. Referrals are open to free accounts too.
 *
 * The money is not involved in either. Nothing is charged, nothing recurs, and
 * no processor hears about it: both end up in `grantMonths`, which writes the
 * "paid through this date" shape the entitlement code already understands.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { grantMonths } from '@/lib/billing/months'
import { mintInviteCode, parseInviteCode } from '@/lib/invite'
import { normaliseHandle } from '@/lib/profile/routes'

/** One month per code. Simple to explain, simple to mint, hard to game. */
export const GIFT_MONTHS = 1
/** How many codes one supporter may have live at once. */
export const MAX_LIVE_CODES = 5
/** Sign-ups from your page that earn you a month. */
export const REFERRALS_PER_MONTH = 3
/**
 * The most months referrals ever earn one account.
 *
 * ponytail: free accounts can refer now, and a Google account costs nothing,
 * so three throwaways would otherwise be a month forever. Six months bounds the
 * worst case; the upgrade path is crediting a referral only once the new
 * account has done something (a play, a save) rather than on account creation.
 */
export const MAX_REFERRAL_MONTHS = 6

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 10

/**
 * A code somebody reads off a screen and types into another one.
 *
 * No 0/O, no 1/I/L: the whole point is that it survives being written on paper
 * or read down a phone. 31^10 is far more than enough entropy for a table that
 * will never hold more than a few thousand rows, and every lookup is against a
 * PRIMARY KEY.
 */
export function mintCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)]
  }
  return code
}

/**
 * What somebody typed, as a code — or null.
 *
 * Case and dashes are forgiven because people type codes the way they read
 * them. Everything else is rejected before it reaches the database.
 */
export function normaliseCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.toUpperCase().replace(/[\s-]/g, '')
  if (code.length !== CODE_LENGTH) return null
  if (![...code].every((char) => ALPHABET.includes(char))) return null
  return code
}

/** Whether the sign-up that took a referrer to `count` earns them a month. */
export function referralEarnsMonth(count: number): boolean {
  if (count <= 0 || count % REFERRALS_PER_MONTH !== 0) return false
  return count / REFERRALS_PER_MONTH <= MAX_REFERRAL_MONTHS
}

/**
 * Which column the referral cookie names somebody by.
 *
 * It carries either an invite code or a public handle; the two formats cannot
 * overlap (a handle has no underscore), so the shape decides.
 */
export function referrerLookup(
  raw: unknown
): { column: 'invite_code' | 'handle'; value: string } | null {
  const invite = parseInviteCode(raw)
  if (invite) return { column: 'invite_code', value: invite }
  const handle = normaliseHandle(raw)
  return handle ? { column: 'handle', value: handle } : null
}

/**
 * This account's invite code, minted the first time anybody asks for it.
 *
 * The conditional UPDATE means two tabs opening the panel at once agree on one
 * code: the loser's write changes nothing and the read-back returns the winner.
 */
async function inviteCodeFor(db: D1Database, userId: string): Promise<string> {
  const read = () =>
    db
      .prepare('SELECT invite_code FROM users WHERE id = ?')
      .bind(userId)
      .first<{ invite_code: string | null }>()

  const existing = (await read())?.invite_code
  if (existing) return existing

  const code = mintInviteCode()
  await db
    .prepare(
      'UPDATE users SET invite_code = ? WHERE id = ? AND invite_code IS NULL'
    )
    .bind(code, userId)
    .run()
  return (await read())?.invite_code ?? code
}

/** How many more sign-ups until the next free month, and how many are banked. */
export function referralProgress(count: number): {
  earned: number
  toNext: number
} {
  const earned = Math.floor(count / REFERRALS_PER_MONTH)
  return { earned, toNext: REFERRALS_PER_MONTH - (count % REFERRALS_PER_MONTH) }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

interface CodeRow {
  code: string
  months: number
  created_at: number
  redeemed_by: string | null
  redeemed_at: number | null
}

/**
 * GET  /api/gifts — this account's codes, and its referral count.
 * POST /api/gifts — { action: 'mint' } or { action: 'redeem', code }.
 *
 * Redeeming is the one action here a NON-supporter can take, and has to be:
 * receiving a gift is how somebody stops being one.
 */
export async function handleGifts(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)

  if (request.method === 'GET') return json(await overview(db, user.id, now))

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ success: false, error: 'Bad request' }, 400)
  }

  if (body.action === 'redeem') return redeem(db, user.id, body.code, now)

  if (body.action !== 'mint') {
    return json({ success: false, error: 'Unknown action' }, 400)
  }

  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'Only supporters can give a month away.' },
      402
    )
  }

  const live = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM gift_codes WHERE created_by = ? AND redeemed_by IS NULL'
    )
    .bind(user.id)
    .first<{ n: number }>()
  if ((live?.n ?? 0) >= MAX_LIVE_CODES) {
    return json(
      {
        success: false,
        error: `You have ${MAX_LIVE_CODES} codes waiting to be used. Pass those on first.`,
      },
      409
    )
  }

  const code = mintCode()
  await db
    .prepare(
      `INSERT INTO gift_codes (code, created_by, months, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(code, user.id, GIFT_MONTHS, now)
    .run()

  return json({ ...(await overview(db, user.id, now)), code })
}

/**
 * Spend a code.
 *
 * The conditional UPDATE is the whole safety property: `redeemed_by IS NULL` in
 * the WHERE means two people racing the same code both pass the SELECT and only
 * one passes the write. The grant is only applied if that write actually
 * changed a row.
 */
async function redeem(
  db: D1Database,
  userId: string,
  raw: unknown,
  now: number
): Promise<Response> {
  const code = normaliseCode(raw)
  if (!code) return json({ success: false, error: 'That is not a code.' }, 400)

  const row = await db
    .prepare(
      'SELECT code, months, created_by, redeemed_by FROM gift_codes WHERE code = ?'
    )
    .bind(code)
    .first<{
      code: string
      months: number
      created_by: string
      redeemed_by: string | null
    }>()

  if (!row) return json({ success: false, error: 'No such code.' }, 404)
  if (row.redeemed_by) {
    return json({ success: false, error: 'That code has been used.' }, 409)
  }
  // Not a rule about fairness — a code you minted came out of your own support,
  // so redeeming it yourself is a loop that prints months.
  if (row.created_by === userId) {
    return json(
      { success: false, error: 'That is your own code. Send it to somebody.' },
      409
    )
  }

  const claimed = await db
    .prepare(
      'UPDATE gift_codes SET redeemed_by = ?, redeemed_at = ? WHERE code = ? AND redeemed_by IS NULL'
    )
    .bind(userId, now, code)
    .run()

  const changes = Number(
    (claimed.meta as { changes?: number } | undefined)?.changes ?? 0
  )
  if (changes === 0) {
    return json({ success: false, error: 'That code has been used.' }, 409)
  }

  const endsAt = await grantMonths(db, userId, row.months, now)
  return json({ success: true, months: row.months, endsAt })
}

/** The codes this account minted, and how its referrals are going. */
async function overview(db: D1Database, userId: string, now: number) {
  const [codes, referrals, inviteCode] = await Promise.all([
    db
      .prepare(
        `SELECT code, months, created_at, redeemed_by, redeemed_at
         FROM gift_codes WHERE created_by = ?
         ORDER BY created_at DESC LIMIT ${MAX_LIVE_CODES * 4}`
      )
      .bind(userId)
      .all<CodeRow>(),
    db
      .prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?')
      .bind(userId)
      .first<{ n: number }>(),
    inviteCodeFor(db, userId),
  ])

  const count = referrals?.n ?? 0
  return {
    success: true,
    now,
    codes: (codes.results ?? []).map((row) => ({
      code: row.code,
      months: row.months,
      created_at: row.created_at,
      used: row.redeemed_by !== null,
    })),
    referrals: count,
    inviteCode,
    maxMonths: MAX_REFERRAL_MONTHS,
    ...referralProgress(count),
  }
}
