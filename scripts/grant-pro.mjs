#!/usr/bin/env node
// Hand a supporter grant to an address, or take it back.
//
//   pnpm pro someone@example.com                     # grant, lifetime
//   pnpm pro someone@example.com --until 1y          # grant for a year from today
//   pnpm pro someone@example.com --until 2027-11-09  # grant until that day (UTC)
//   pnpm pro someone@example.com --revoke            # take it back
//
// `--until` stores an end date (migrations/0015) and Pro switches itself off
// then. Granting again without it makes the address lifetime and clears any
// date; --revoke clears both.
//
// Writes the two places a supporter grant lives, in this order and for these
// reasons (read back on sign-in by lib/billing/supporters.ts):
//
//   supporters  the durable record, keyed by the address that paid. This is
//               what closes the paid-before-signup gap — an account created
//               later claims it on sign-in (claimSupporterGrants), so granting
//               to an address with no account yet is a normal, supported thing
//               to do rather than a silent miss.
//   users       the column the app actually reads, refreshed for every row
//               holding that address. Read-modify-write, never `grants='pro'`:
//               the column is a set and an assignment detaches the rest.
//
// `lifetime = 1` because a hand grant has no subscription behind it to expire,
// and the flag is what stops a future cancellation event from revoking it.
//
// Revoking mirrors the webhook's cancellation: the supporters row survives as a
// tombstone (grants = ''), because `updated_at` is the only thing that can
// refuse a stale redelivery and deleting the row throws that away.
import { loadLocalEnv } from './load-env.mjs'
import { parseUntil, splitUntil } from './pro-until.mjs'

loadLocalEnv()

const args = process.argv.slice(2)
const revoke = args.includes('--revoke')
const { raw: untilRaw, rest } = splitUntil(args)
const email = rest
  .find((a) => !a.startsWith('-'))
  ?.trim()
  .toLowerCase()

const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim()
const ACCOUNT_ID = '90d6fc64545d1c449331032979dcbfb5'
const DATABASE_ID = '3ef0e030-df5b-4852-8fda-bda034b004b7'
const GRANT = 'pro'

function fail(message) {
  console.error(`\n✘ ${message}`)
  process.exit(1)
}

if (!email) fail('usage: pnpm pro <email> [--until YYYY-MM-DD|1y] [--revoke]')
if (revoke && untilRaw !== null) {
  fail('--until and --revoke together make no sense: pick one')
}
let until = null
if (untilRaw !== null) {
  try {
    until = parseUntil(untilRaw)
  } catch (error) {
    fail(error.message)
  }
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`not an email: ${email}`)
if (!TOKEN) fail('CLOUDFLARE_API_TOKEN is not set (.env.local)')

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  )
  const json = await res.json()
  if (!json.success) fail(`D1 query failed: ${JSON.stringify(json.errors)}`)
  return json.result?.[0]?.results ?? []
}

/** The stored set, trimmed and de-duplicated. Mirrors lib/billing/entitlement.ts. */
const parse = (current) => [
  ...new Set(
    (current ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
  ),
]

const withGrant = (current) => {
  const names = parse(current)
  if (!names.includes(GRANT)) names.push(GRANT)
  return names.join(',')
}

const withoutGrant = (current) => {
  const names = parse(current).filter((n) => n !== GRANT)
  return names.length > 0 ? names.join(',') : null
}

const now = Date.now()

if (revoke) {
  await d1(
    `UPDATE supporters SET grants = '', lifetime = 0, ends_at = NULL, source = 'manual', updated_at = ? WHERE email = ?`,
    [now, email]
  )
} else {
  // The latest grant is the truth, dates included: `--until` on a lifetime
  // supporter makes them time-limited, and a plain grant clears a date.
  await d1(
    `INSERT INTO supporters (email, grants, level, lifetime, source, event_id, ends_at, updated_at)
     VALUES (?, ?, 'manual', ?, 'manual', NULL, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       grants = excluded.grants,
       level = excluded.level,
       lifetime = excluded.lifetime,
       ends_at = excluded.ends_at,
       source = excluded.source,
       updated_at = excluded.updated_at`,
    [email, GRANT, until === null ? 1 : 0, until, now]
  )
}

// Every row with that address: the email index is deliberately not UNIQUE (a
// deleted and recreated Google account can legitimately leave two).
// A revoke clears the date along with the grant.
const nextUntil = revoke ? null : until
const users = await d1(
  'SELECT id, grants, pro_until FROM users WHERE email = ?',
  [email]
)
for (const user of users) {
  const next = revoke ? withoutGrant(user.grants) : withGrant(user.grants)
  if (next === user.grants && nextUntil === (user.pro_until ?? null)) continue
  await d1('UPDATE users SET grants = ?, pro_until = ? WHERE id = ?', [
    next,
    nextUntil,
    user.id,
  ])
}

const verb = revoke ? 'revoked' : 'granted'
console.log(`\n✔ ${GRANT} ${verb} for ${email}`)
if (!revoke) {
  console.log(
    until === null
      ? '  Lifetime: no end date.'
      : `  Until ${new Date(until).toISOString().slice(0, 10)} 00:00 UTC, then it switches itself off.`
  )
}
if (users.length === 0) {
  console.log(
    revoke
      ? '  No account holds that address — the supporters row is tombstoned, so a later sign-in claims nothing.'
      : '  No account holds that address yet — it is claimed on their first sign-in.'
  )
} else {
  for (const user of users) console.log(`  account ${user.id}`)
}
