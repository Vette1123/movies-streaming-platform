// The two budgets the relay actually answers to, measured from production.
//
//   node scripts/relay-usage.mjs         # last 24h
//   node scripts/relay-usage.mjs 168     # last 7d
//
// 1. THE NETLIFY CREDIT POOL. Both relay sites are one team ("Reely") on the
//    credit-free plan: 300 credits/month, a hard limit — when the balance
//    empties, EVERY project on the team pauses, the relays included, and
//    visitors see `Site not available` (no card on file, so no auto top-up).
//    The team API exposes the live balance (`credits.used`), which is what
//    this prints. The meters that spend it (Netlify "How credits work",
//    fetched 2026-11-18):
//      production deploy   15 credits  — `npm run deploy` ships 2 sites = 30
//      bandwidth           20 credits / GB — the relay proxies video bytes
//      web requests        2 credits / 10k — edge functions are measured here
//    The old per-plan invocation number is gone: under credit pricing an edge
//    function's usage lands in web requests, not invocations.
//
// 2. THE FRONT REQUEST RATE. Every request a viewer (or the canary) sends the
//    CF front — relay.reely.space / relay-b.reely.space, the hosts browsers
//    can actually reach — is one web request on the team, plus one more for
//    /selftest's own hop to its netlify.app origin. CF telemetry counts them
//    per host; `observability.enabled` went live in the 2026-11-18 front
//    deploy, so history starts there.
//
// Read-only: one Netlify GET, two CF telemetry counts. Exits 1 only when the
// credit pool itself cannot be read — that is the number that must not hide.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const NF_TOKEN = process.env.NETLIFY_AUTH_TOKEN

if (!CF_TOKEN || !NF_TOKEN) {
  console.error('Need CLOUDFLARE_API_TOKEN and NETLIFY_AUTH_TOKEN (in .env.local).')
  process.exit(1)
}

/** Team "Reely" (account 6afb92f2c79b626d3cee5375) — hosts both relay sites. */
const NF_ACCOUNT = '6afb92f2c79b626d3cee5375'
const PLAN_CREDITS = 300
const CREDITS = { deploy: 15, perGB: 20, per10kRequests: 2 }
const CF_FRONT_DAILY_CAP = 100_000 // CF Workers free plan, per day, per account

const HOSTS = ['relay.reely.space', 'relay-b.reely.space']

const wrangler = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')
const CF_ACCOUNT = wrangler.match(/"account_id":\s*"([^"]+)"/)?.[1]
if (!CF_ACCOUNT) {
  console.error('account_id missing from wrangler.jsonc')
  process.exit(1)
}
const to = Date.now()
const from = to - (Number(process.argv[2]) || 24) * 3600 * 1000
const from48 = to - 48 * 3600 * 1000

const telemetryCount = async (host, since) => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/observability/telemetry/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queryId: 'relay-usage',
        timeframe: { from: since, to },
        limit: 1,
        dry: false,
        parameters: {
          datasets: ['cloudflare-workers'],
          filters: [{ key: '$workers.event.request.url', operation: 'includes', type: 'string', value: host }],
          calculations: [{ operator: 'count', alias: 'n' }],
        },
      }),
    }
  )
  const body = await res.json().catch(() => null)
  if (!body?.success) throw new Error(`telemetry query failed (${res.status}): ${JSON.stringify(body?.errors ?? body).slice(0, 200)}`)
  return Number(body.result?.calculations?.[0]?.aggregates?.[0]?.value ?? 0)
}

// 1. The credit pool — the account object carries the live ledger.
const acctRes = await fetch(`https://api.netlify.com/api/v1/accounts/${NF_ACCOUNT}`, {
  headers: { Authorization: `Bearer ${NF_TOKEN}` },
})
if (!acctRes.ok) {
  console.error(`Netlify account read failed (${acctRes.status}) — the credit balance is the number that must not hide.`)
  process.exit(1)
}
const acct = await acctRes.json()
const used = Number(acct.capabilities?.credits?.used ?? 0)
const left = PLAN_CREDITS - used
const periodEnd = Date.parse(acct.next_usage_period_start ?? '')
const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd - to) / 86_400_000)) : '?'

console.log('== netlify credit pool (team Reely, credit-free: 300/month, hard limit) ==')
console.log(
  `  balance: ${used} used / ${left} left | period resets ${acct.next_usage_period_start?.slice(0, 10) ?? '?'} (${daysLeft} days left)`
)
console.log(
  `  meters: production deploy ${CREDITS.deploy} each (npm run deploy = ${CREDITS.deploy * 2}) | bandwidth ${CREDITS.perGB}/GB | web requests ${CREDITS.per10kRequests}/10k`
)
console.log(
  `  headroom at the meters: ${(left / CREDITS.perGB).toFixed(0)} GB of relayed video (~${(left / CREDITS.perGB / 1.5).toFixed(0)} films at 1.5GB)` +
    ` | ${Math.floor((left * 10_000) / CREDITS.per10kRequests).toLocaleString()} requests` +
    ` | ${Math.floor(left / (CREDITS.deploy * 2))} relay deploys`
)
if (acct.sites_with_usage_exceeded?.length)
  console.log(`  ! sites over their own limits: ${acct.sites_with_usage_exceeded.join(', ')}`)

// 2. Front request rate per host.
console.log(`\n== front requests (CF telemetry, window ${(to - from) / 3_600_000}h) ==`)
let fail = 0
const rate24 = {}
for (const host of HOSTS) {
  try {
    const [n24, n48] = [await telemetryCount(host, from), await telemetryCount(host, from48)]
    rate24[host] = n24
    console.log(`  ${host.padEnd(20)} 24h ${String(n24).padStart(7)} | 48h ${String(n48).padStart(7)}`)
  } catch (e) {
    fail++
    console.log(`  ${host.padEnd(20)} telemetry error: ${String(e).slice(0, 120)}`)
  }
}
if (fail < HOSTS.length) {
  const n = Object.values(rate24).reduce((a, b) => a + b, 0)
  const monthlyReq = Math.round((n / 24) * 30.44)
  const monthlyCredits = Math.ceil((monthlyReq * CREDITS.per10kRequests) / 10_000)
  console.log(
    `  → ${n ? 'note: history accrues from the 2026-11-18 observability enable' : 'n is 0 until history accrues (observability enabled 2026-11-18)'}`
  )
  console.log(
    `  → at today's rate: ~${monthlyReq.toLocaleString()} requests/month = ${monthlyCredits} web-request credit${monthlyCredits === 1 ? '' : 's'} (${((monthlyCredits / PLAN_CREDITS) * 100).toFixed(1)}% of the pool; upper bound - front cache hits never reach the relay)`
  )
  const busiest = Object.entries(rate24).sort((a, b) => b[1] - a[1])[0]
  if (busiest?.[1])
    console.log(
      `  → CF front cap ${CF_FRONT_DAILY_CAP.toLocaleString()}/day: busiest host ${busiest[0]} at ${((busiest[1] / CF_FRONT_DAILY_CAP) * 100).toFixed(2)}%`
    )
}

console.log('\nWhen the pool empties every Netlify project pauses — the relay canary (scripts/relay-canary.mjs) is the outage alarm; this is the wallet gauge.')
process.exit(fail === HOSTS.length ? 1 : 0)
