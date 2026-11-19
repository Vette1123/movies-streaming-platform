// The two budgets the relay actually answers to, measured from production.
//
//   node scripts/relay-usage.mjs         # last 24h
//   node scripts/relay-usage.mjs 168     # last 7d
//
// 1. THE NETLIFY CREDIT POOL. Relay-b (the cold fallback, `reely-relay-b2`)
//    is the only relay home still on Netlify, on a credit-free plan: 300
//    credits/month, a hard limit — when the balance empties, EVERY project
//    on that account pauses and visitors see `Site not available` (no card
//    on file, so no auto top-up). Relay 1 left Netlify on 2026-11-19 for an
//    Oracle Always Free VM, so the primary path spends none of this pool.
//    The meters that spend it (Netlify "How credits work", fetched 2026-11-18):
//      production deploy   15 credits  — `npm run deploy` ships 1 site = 15
//      bandwidth           20 credits / GB — the relay proxies video bytes
//      web requests        2 credits / 10k — edge functions are measured here
//
//    What the APIs can and cannot see (measured 2026-11-18):
//      - deploys are COUNTED EXACTLY from the deploys API (ready + production
//        in the current period, per site), priced at 15 each. The one meter
//        with a source of truth — and the one that spikes on shipping days.
//      - `credits.used` on the account object is STALE: it read 0 while the
//        team dashboard showed 145.6 credits spent. Printed as a red flag
//        only, never as the balance. The dashboard is the truth.
//      - bandwidth has NO API (every CF telemetry bytes key answers 0). The
//        dashboard is the only place it appears; budget it by hand —
//        300 credits = 15 GB ≈ ten 1.5 GB films relayed through Netlify.
//      - web requests are projected from CF telemetry and are an UPPER BOUND:
//        front cache hits never reach the relay (CACHE_RULES in
//        workers/relay-front/worker.mjs), so the relay's own count is lower.
//
// 2. THE FRONT REQUEST RATE. Every request a viewer (or the canary) sends the
//    CF front — relay.reely.space / relay-b.reely.space, the hosts browsers
//    can actually reach — is counted per host from CF telemetry
//    (`observability.enabled`, live since the 2026-11-18 front deploy). Only
//    relay-b's requests become Netlify web requests (plus /selftest's own hop
//    to its netlify.app origin); relay 1's end at the Oracle VM.
//
// Read-only: one Netlify account GET + one deploys GET, and two CF telemetry
// counts per host. Exits 1 only when the credit pool itself cannot be read —
// that is the number that must not hide.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const NF_TOKEN = process.env.NETLIFY_AUTH_TOKEN_B

if (!CF_TOKEN || !NF_TOKEN) {
  console.error(
    'Need CLOUDFLARE_API_TOKEN and NETLIFY_AUTH_TOKEN_B (in .env.local).'
  )
  process.exit(1)
}

/** The fallback's account (`NETLIFY_ACCOUNT_B`) — relay-b only. */
const NF_ACCOUNT = process.env.NETLIFY_ACCOUNT_B ?? ''
const PLAN_CREDITS = 300
const CREDITS = { deploy: 15, perGB: 20, per10kRequests: 2 }
const CF_FRONT_DAILY_CAP = 100_000 // CF Workers free plan, per day, per account

const HOSTS = [
  { host: 'relay.reely.space', netlify: false },
  { host: 'relay-b.reely.space', netlify: true },
]
// Relay-b is the only Netlify home left: relay 1 moved to the Oracle VM on
// 2026-11-19 and spends nothing here. The old `reely-relay` site (team Reely)
// is idle and can be deleted once the move has soaked.
const SITE_B = '47406758-6292-428a-b851-0bee16c682b1' // reely-relay-b2 (fallback)

const wrangler = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')
const CF_ACCOUNT = wrangler.match(/"account_id":\s*"([^"]+)"/)?.[1]
if (!CF_ACCOUNT) {
  console.error('account_id missing from wrangler.jsonc')
  process.exit(1)
}
const to = Date.now()
const from = to - (Number(process.argv[2]) || 24) * 3600 * 1000
const from48 = to - 48 * 3600 * 1000

const WALLETS = [
  {
    name: 'Reely B (relay-b fallback)',
    token: NF_TOKEN,
    account: NF_ACCOUNT,
    sites: [{ id: SITE_B, label: 'reely-relay-b2' }],
  },
]

const netlify = (token, route) =>
  fetch(`https://api.netlify.com/api/v1${route}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

const telemetryCount = async (host, since) => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/observability/telemetry/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queryId: 'relay-usage',
        timeframe: { from: since, to },
        limit: 1,
        dry: false,
        parameters: {
          datasets: ['cloudflare-workers'],
          filters: [
            {
              key: '$workers.event.request.url',
              operation: 'includes',
              type: 'string',
              value: host,
            },
          ],
          calculations: [{ operator: 'count', alias: 'n' }],
        },
      }),
    }
  )
  const body = await res.json().catch(() => null)
  if (!body?.success)
    throw new Error(
      `telemetry query failed (${res.status}): ${JSON.stringify(body?.errors ?? body).slice(0, 200)}`
    )
  return Number(body.result?.calculations?.[0]?.aggregates?.[0]?.value ?? 0)
}

/** The billing period [start, end) and the (stale) API ledger for a wallet. */
async function walletPeriod(wallet) {
  if (!wallet.account) {
    const start = new Date(to)
    start.setDate(start.getDate() - 30)
    return { end: null, start, creditsUsed: null, exceeded: [] }
  }
  const res = await netlify(wallet.token, `/accounts/${wallet.account}`)
  if (!res.ok) return null
  const acct = await res.json()
  const end = acct.next_usage_period_start
    ? new Date(acct.next_usage_period_start)
    : null
  const start = end ? new Date(end) : new Date(to)
  if (end) start.setMonth(start.getMonth() - 1)
  else start.setDate(start.getDate() - 30)
  return {
    end,
    start,
    creditsUsed: Number(acct.capabilities?.credits?.used ?? 0),
    exceeded: acct.sites_with_usage_exceeded ?? [],
  }
}

/** Ready production deploys inside the period, from the deploys API. */
async function deployCount(wallet, start) {
  let total = 0
  const lines = []
  for (const site of wallet.sites) {
    const res = await netlify(
      wallet.token,
      `/sites/${site.id}/deploys?state=ready&production=true&per_page=50`
    )
    if (!res.ok) {
      lines.push(
        `  ${site.label.padEnd(14)} deploys unreadable (${res.status})`
      )
      continue
    }
    const parsed = await res.json().catch(() => [])
    const list = Array.isArray(parsed) ? parsed : []
    const inPeriod = list.filter((d) => {
      const t = Date.parse(d.created_at ?? '')
      return Number.isFinite(t) && t >= start.getTime()
    })
    total += inPeriod.length
    const when = inPeriod
      .map((d) => (d.created_at ?? '').slice(0, 16).replace('T', ' '))
      .join(', ')
    lines.push(
      `  ${site.label.padEnd(14)} ${inPeriod.length} production deploy${inPeriod.length === 1 ? '' : 's'}${when ? ` (${when})` : ''}`
    )
  }
  return { total, lines }
}

// 1. The wallets — deploys exact, bandwidth dashboard-only.
let hardFail = 0
const perWallet = []
for (const wallet of WALLETS) {
  const p = await walletPeriod(wallet)
  if (!p) {
    console.log(
      `== netlify wallet "${wallet.name}": account read FAILED — the credit pool is the number that must not hide ==`
    )
    hardFail++
    continue
  }
  const daysLeft = p.end
    ? Math.max(0, Math.ceil((p.end - to) / 86_400_000))
    : '?'
  console.log(
    `== netlify wallet "${wallet.name}" (credit-free: ${PLAN_CREDITS}/month, hard limit) ==`
  )
  console.log(
    `  period: ${p.start.toISOString().slice(0, 10)} -> ${p.end ? p.end.toISOString().slice(0, 10) : '?'} (${daysLeft} days left)`
  )
  console.log(
    `  API ledger: ${p.creditsUsed ?? '?'} used — STALE, ignore (2026-11-18: read 0 while the dashboard showed 145.6). The dashboard is the truth.`
  )
  const d = await deployCount(wallet, p.start)
  console.log('  production deploys this period (exact, deploys API):')
  for (const line of d.lines) console.log(line)
  console.log(
    `  => deploy credits: ${d.total} x ${CREDITS.deploy} = ${d.total * CREDITS.deploy} (spikes are shipping days, not steady state)`
  )
  if (p.exceeded.length)
    console.log(`  ! sites over their own limits: ${p.exceeded.join(', ')}`)
  perWallet.push({ name: wallet.name, deploys: d.total })
}

// 2. Front request rate per host.
console.log(
  `\n== front requests (CF telemetry, window ${(to - from) / 3_600_000}h) ==`
)
let telemetryFail = 0
const rate24 = {}
for (const { host } of HOSTS) {
  try {
    const [n24, n48] = [
      await telemetryCount(host, from),
      await telemetryCount(host, from48),
    ]
    rate24[host] = n24
    console.log(
      `  ${host.padEnd(20)} 24h ${String(n24).padStart(7)} | 48h ${String(n48).padStart(7)}`
    )
  } catch (e) {
    telemetryFail++
    console.log(
      `  ${host.padEnd(20)} telemetry error: ${String(e).slice(0, 120)}`
    )
  }
}

const deployCredits = perWallet.reduce(
  (a, w) => a + w.deploys * CREDITS.deploy,
  0
)
const netlifyHosts = HOSTS.filter((h) => h.netlify)
const netlifyRateOk = netlifyHosts.every((h) => rate24[h.host] !== undefined)
let monthlyReqCredits = 0
if (netlifyRateOk) {
  const n = netlifyHosts.reduce((a, h) => a + rate24[h.host], 0)
  const monthlyReq = Math.round((n / 24) * 30.44)
  monthlyReqCredits = Math.ceil((monthlyReq * CREDITS.per10kRequests) / 10_000)
  console.log(
    `  → at today's rate: ~${monthlyReq.toLocaleString()} requests/month = ${monthlyReqCredits} web-request credit${monthlyReqCredits === 1 ? '' : 's'} (${((monthlyReqCredits / PLAN_CREDITS) * 100).toFixed(1)}% of the pool; upper bound - front cache hits never reach the relay)`
  )
}
if (telemetryFail < HOSTS.length) {
  const busiest = Object.entries(rate24).sort((a, b) => b[1] - a[1])[0]
  if (busiest?.[1])
    console.log(
      `  → CF front cap ${CF_FRONT_DAILY_CAP.toLocaleString()}/day: busiest host ${busiest[0]} at ${((busiest[1] / CF_FRONT_DAILY_CAP) * 100).toFixed(2)}%`
    )
}

// 3. The meters, as far as the APIs can see them.
console.log('\n== the meters (what the APIs can see) ==')
console.log(`  deploys this period: ${deployCredits} credits (exact)`)
console.log(
  `  bandwidth: dashboard only — ${PLAN_CREDITS} credits = ${PLAN_CREDITS / CREDITS.perGB} GB ≈ ten 1.5 GB films; the front cache (shared /pl, /seg, /resolve) is what keeps repeats off this meter`
)
for (const w of perWallet) {
  const conservLeft =
    PLAN_CREDITS - w.deploys * CREDITS.deploy - monthlyReqCredits
  console.log(
    `  wallet "${w.name}": ~${conservLeft} of ${PLAN_CREDITS} credits left before bandwidth (deploys exact, requests upper bound)`
  )
}

console.log(
  '\nWhen the pool empties every Netlify project pauses — the relay canary (scripts/relay-canary.mjs) is the outage alarm; this is the wallet gauge.'
)
process.exit(hardFail ? 1 : 0)
