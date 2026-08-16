#!/usr/bin/env node
// End-to-end probe of the Buy Me a Coffee webhook, against a REAL deployment.
//
//   pnpm bmc:probe                     # production (www.reely.space + apex)
//   pnpm bmc:probe http://localhost:8788   # a local `pnpm preview`
//
// Why this exists rather than a unit test: the four things that break this
// endpoint in production cannot be tested from inside the process. The signing
// secret can differ between `.env.local` and the Worker; the WAF can challenge a
// machine caller; a host-level redirect can turn a delivery into a 301 (it did —
// the apex→www rule used to match this path); and D1 can reject a write the code
// believes it made. All four are only visible from outside, so this signs real
// payloads, POSTs them at a real deployment, and asserts on the row D1 actually
// holds afterwards.
//
// Safe to run against production. Everything it writes belongs to PROBE_EMAIL,
// which no account can ever be signed in as, and the last step deletes it.
// Read-only for every other row.
import { createHmac } from 'node:crypto'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const BASE = (process.argv[2] ?? 'https://www.reely.space').replace(/\/$/, '')
const APEX = BASE.replace('://www.', '://')
const PATH = '/api/billing/bmc'
const PROBE_EMAIL = 'webhook-probe@reely.space'

const SECRET = process.env.BMC_WEBHOOK_SECRET?.trim()
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim()
const ACCOUNT_ID = '90d6fc64545d1c449331032979dcbfb5'
const DATABASE_ID = '3ef0e030-df5b-4852-8fda-bda034b004b7'

// Kept as literals rather than imported from config/support.ts: the point of the
// probe is to prove the DEPLOYED build recognises these names. Importing the
// same constant the Worker was built from would make a rename invisible here,
// which is the exact failure mode ("level not configured here") this catches.
const MEMBERSHIP = 'Reely — Supporter'
const LIFETIME = 'Lifetime — everything I build'

if (!SECRET)
  fail('BMC_WEBHOOK_SECRET is not set (.env.local or the environment)')
if (!TOKEN)
  fail('CLOUDFLARE_API_TOKEN is not set — the probe reads D1 to assert')

function fail(message) {
  console.error(`\n✘ ${message}`)
  process.exit(1)
}

const sign = (raw) => createHmac('sha256', SECRET).update(raw).digest('hex')

async function post(payload, { host = BASE, signature, userAgent } = {}) {
  const raw = JSON.stringify(payload)
  const res = await fetch(`${host}${PATH}`, {
    method: 'POST',
    // manual: a webhook sender is not a browser, and following the redirect
    // here would hide exactly the failure this checks for.
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      'x-signature-sha256': signature ?? sign(raw),
      ...(userAgent === undefined ? {} : { 'user-agent': userAgent }),
    },
    body: raw,
  })
  return { status: res.status, location: res.headers.get('location') }
}

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

const row = async () =>
  (
    await d1(
      'SELECT grants, level, lifetime, event_id FROM supporters WHERE email = ?',
      [PROBE_EMAIL]
    )
  )[0] ?? null

// `created` is epoch SECONDS on the real envelope, and the handler's staleness
// guard compares it — so an offset here is how out-of-order delivery is tested.
const event = (type, level, id, offset = 0, key = 'level') => ({
  event_id: id,
  type,
  live_mode: true,
  created: Math.floor(Date.now() / 1000) + offset,
  attempt: 1,
  data: { supporter_email: PROBE_EMAIL, [key]: { name: level } },
})

let failures = 0

function check(name, ok, detail) {
  console.log(`  ${ok ? '✓' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// Event ids have to be unique per run or the redelivery guard refuses the whole
// probe on a second run. Derived from the clock, in the space real ids never
// reach.
const id = 900000000 + (Math.floor(Date.now() / 1000) % 10000000)

console.log(`\nBMC webhook probe → ${BASE}${PATH}\n`)

// Nothing granted yet: a leftover row from an interrupted run would make every
// assertion below meaningless.
await d1('DELETE FROM supporters WHERE email = ?', [PROBE_EMAIL])

console.log('signature')
{
  const res = await post(event('membership.started', MEMBERSHIP, id), {
    signature: 'deadbeef',
  })
  check('a bad signature is rejected', res.status === 401, `HTTP ${res.status}`)
  check(
    'rejected without a WAF challenge',
    res.status !== 403,
    `HTTP ${res.status}`
  )
}

console.log('\ndelivery')
{
  // Empty UA on purpose: that is what a webhook sender looks like, and it is
  // the shape the scraper rule would challenge on any other path.
  const res = await post(event('membership.started', MEMBERSHIP, id + 1), {
    userAgent: '',
  })
  const r = await row()
  check(
    'an empty user-agent is served',
    res.status === 200,
    `HTTP ${res.status}`
  )
  check(
    'the membership granted',
    r?.grants === 'pro',
    `grants=${r?.grants ?? 'none'}`
  )
}
{
  const res = await post(event('membership.started', MEMBERSHIP, id + 1))
  const r = await row()
  check(
    'a redelivery changes nothing',
    res.status === 200 && r?.event_id === id + 1,
    `event_id=${r?.event_id}`
  )
}
{
  const res = await post(event('membership.started', MEMBERSHIP, id + 2), {
    host: APEX,
  })
  check(
    'the apex host answers instead of redirecting',
    res.status === 200,
    res.location ? `HTTP ${res.status} → ${res.location}` : `HTTP ${res.status}`
  )
}

console.log('\nlevels')
{
  await post(event('extra_purchase.created', LIFETIME, id + 3, 1, 'extra'))
  const r = await row()
  check(
    'the lifetime extra is recognised',
    r?.lifetime === 1,
    `lifetime=${r?.lifetime}`
  )
}
{
  await post(event('membership.cancelled', MEMBERSHIP, id + 4, 2))
  const r = await row()
  check('cancelling does not revoke a lifetime', r?.grants === 'pro')
}
{
  await post(event('membership.started', 'Downloader — Supporter', id + 5, 3))
  const r = await row()
  check(
    "a sibling project's level grants nothing here",
    r?.level === LIFETIME,
    `level=${r?.level}`
  )
}

console.log('\nrecurring cancellation')
await d1('DELETE FROM supporters WHERE email = ?', [PROBE_EMAIL])
{
  await post(event('recurring_donation.started', MEMBERSHIP, id + 6, 4))
  await post(event('membership.cancelled', MEMBERSHIP, id + 7, 5))
  const r = await row()
  check(
    'the grant is emptied',
    r?.grants === '',
    `grants=${JSON.stringify(r?.grants)}`
  )
  check('the row survives as a tombstone', r !== null)
}
{
  // The stale-delivery case that used to resurrect a cancelled membership:
  // a `started` stamped BEFORE the cancellation, delivered after it.
  await post(event('membership.started', MEMBERSHIP, id + 8, -600))
  const r = await row()
  check('a stale start does not resurrect it', r?.grants === '')
}

console.log('\nmethod')
{
  const res = await fetch(`${BASE}${PATH}`, { redirect: 'manual' })
  check('GET is refused cleanly', res.status === 405, `HTTP ${res.status}`)
}

console.log('\ncleanup')
await d1('DELETE FROM supporters WHERE email = ?', [PROBE_EMAIL])
check('the probe row is gone', (await row()) === null)

console.log(
  failures === 0
    ? '\n✓ webhook healthy — signature, WAF, both hosts, grants, revokes, replay\n'
    : `\n✘ ${failures} check(s) failed\n`
)
process.exit(failures === 0 ? 0 : 1)
