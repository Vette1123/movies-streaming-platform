// Per-route Worker CPU, from production. Read-only.
//
//   pnpm cf:cpu              last 6h
//   pnpm cf:cpu 24           last 24h
//
// `pnpm cf:health` answers "is the Worker being killed" — one CPU distribution
// for the whole script, which is the number that matters for the free plan's
// budget but says nothing about WHERE the time goes. Cloudflare's GraphQL
// analytics cannot break it down: `workersInvocationsAdaptive` has no path
// dimension.
//
// Workers Logs can, because `observability.enabled` in wrangler.jsonc makes the
// runtime store `$workers.cpuTimeMs` next to the request URL for every
// invocation. This asks that dataset the question the dashboard cannot: which
// route is expensive, and how much of the traffic goes through it.
//
// It is the tool that turned "CPU feels high" into a list of four routes worth
// fixing (2026-08-20): /api/season-details was shipping 97KB of episode crew
// nobody renders and peaked at 19ms, while the tail-id fallback — 96% of all
// invocations — was already lean at 1.7ms. Guessing would have optimised the
// wrong one.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const HOURS = Number(process.argv[2]) || 6

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN (or put it in .env.local).')
  process.exit(1)
}

const wrangler = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')
const ACCOUNT_ID = wrangler.match(/"account_id":\s*"([^"]+)"/)?.[1]

const to = Date.now()
const from = to - HOURS * 3600 * 1000

/** The free plan's per-invocation ceiling — what all of this is measured against. */
const CPU_LIMIT_MS = 10

// Every route the Worker answers, in the order they are matched. `/api/media/`
// and `/api/collection/` keep their trailing slash so they cannot swallow the
// page routes of the same name.
const ROUTES = [
  '/api/media/',
  '/api/collection/',
  '/api/filter',
  '/api/search',
  '/api/popular',
  '/api/genres',
  '/api/watch-providers',
  '/api/season-details',
  '/api/hero-extras',
  '/api/sync',
  '/api/account',
  '/api/auth/',
  '/api/lists',
  '/api/for-you',
  '/api/next-up',
  '/api/upcoming',
  '/api/calendar/',
  '/api/community',
  '/api/gifts',
  '/api/profile',
  '/movies/',
  '/tv-shows/',
  '/collection/',
  '/lists',
  '/l/',
  '/u/',
]

async function query(filters) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/observability/telemetry/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queryId: 'cf-cpu',
        timeframe: { from, to },
        limit: 1,
        dry: false,
        parameters: {
          datasets: ['cloudflare-workers'],
          filters,
          calculations: [
            { operator: 'count', alias: 'n' },
            {
              operator: 'avg',
              key: '$workers.cpuTimeMs',
              keyType: 'number',
              alias: 'avg',
            },
            {
              operator: 'p99',
              key: '$workers.cpuTimeMs',
              keyType: 'number',
              alias: 'p99',
            },
            {
              operator: 'max',
              key: '$workers.cpuTimeMs',
              keyType: 'number',
              alias: 'max',
            },
          ],
        },
      }),
    }
  )
  const body = await res.json().catch(() => null)
  if (!body?.success) {
    throw new Error(
      `observability query failed (${res.status}): ${JSON.stringify(body?.errors ?? body).slice(0, 300)}`
    )
  }
  const calculations = body.result?.calculations ?? []
  const value = (alias) =>
    calculations.find((entry) => entry.alias === alias)?.aggregates?.[0]?.value
  return {
    n: Number(value('n') ?? 0),
    avg: Number(value('avg') ?? 0),
    p99: Number(value('p99') ?? 0),
    max: Number(value('max') ?? 0),
  }
}

const urlFilter = (value) => [
  {
    key: '$workers.event.request.url',
    operation: 'includes',
    type: 'string',
    value,
  },
]

const row = (label, stats, share) =>
  [
    label.padEnd(21),
    String(stats.n).padStart(7),
    share.padStart(7),
    `${stats.avg.toFixed(2)}ms`.padStart(9),
    `${stats.p99.toFixed(2)}ms`.padStart(9),
    `${stats.max.toFixed(2)}ms`.padStart(9),
  ].join(' ')

console.log(`Worker CPU by route — last ${HOURS}h\n`)
console.log(
  [
    'route'.padEnd(21),
    'n'.padStart(7),
    'share'.padStart(7),
    'avg'.padStart(9),
    'p99'.padStart(9),
    'max'.padStart(9),
  ].join(' ')
)

const all = await query([])
console.log(row('ALL', all, '100%'))
console.log('-'.repeat(67))

const results = []
for (const route of ROUTES) {
  const stats = await query(urlFilter(route))
  if (stats.n === 0) continue
  results.push({ route, ...stats })
}

// Sorted by total CPU spent, not by the worst single request: a 19ms route
// served 98 times matters less than a 1.7ms one served 12,000 times, and the
// point of this script is to say which one to fix first.
results.sort((a, b) => b.avg * b.n - a.avg * a.n)

for (const stats of results) {
  const share = all.n ? `${((stats.n / all.n) * 100).toFixed(1)}%` : '—'
  console.log(row(stats.route, stats, share))
}

const hot = results.filter((stats) => stats.max >= CPU_LIMIT_MS)
console.log()
if (hot.length === 0) {
  console.log(`✓ No route reached the ${CPU_LIMIT_MS}ms budget in this window.`)
} else {
  for (const stats of hot) {
    console.log(
      `! ${stats.route} peaked at ${stats.max.toFixed(2)}ms against a ${CPU_LIMIT_MS}ms budget`
    )
  }
}
console.log(
  '\nCPU is a gauge; kills are the gate — run `pnpm cf:health` for those.'
)
