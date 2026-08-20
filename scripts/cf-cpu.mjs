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

async function query(filters, groupBys) {
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
        limit: groupBys ? 200 : 1,
        dry: false,
        parameters: {
          datasets: ['cloudflare-workers'],
          filters,
          groupBys,
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
  if (groupBys) {
    // One row per group, keyed by the group's value.
    const rows = {}
    for (const entry of calculations) {
      for (const aggregate of entry.aggregates) {
        const key = (aggregate.groups ?? []).map((g) => g.value).join('|')
        rows[key] ??= {}
        rows[key][entry.alias] = Number(aggregate.value ?? 0)
      }
    }
    return rows
  }
  const value = (alias) =>
    calculations.find((entry) => entry.alias === alias)?.aggregates?.[0]?.value
  return {
    n: Number(value('n') ?? 0),
    avg: Number(value('avg') ?? 0),
    p99: Number(value('p99') ?? 0),
    max: Number(value('max') ?? 0),
  }
}

/**
 * The last few deploys, newest first, as `{ id, at }`.
 *
 * Soft-fails to an empty list: this is the only call in the script that needs
 * Workers Scripts read rather than observability, and a token without it should
 * lose one section, not the whole report.
 */
async function deployedVersions() {
  const scriptName = wrangler.match(/"name":\s*"([^"]+)"/)?.[1]
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${scriptName}/versions?per_page=10`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    )
    const body = await res.json()
    return (body.result?.items ?? [])
      .filter((item) => item.id && item.metadata?.created_on)
      .map((item) => ({
        id: item.id,
        // Minute precision: what matters is which deploy, not when to the second.
        at: item.metadata.created_on.slice(0, 16).replace('T', ' '),
      }))
  } catch {
    return []
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

// How much of the busiest route's CPU is isolate startup rather than the work.
//
// There is no cold-start flag in the dataset, but there is a colo, and traffic
// is wildly uneven across them: a colo that saw two requests all window served
// both from a cold isolate, one that saw thousands served almost all of them
// warm. Bucketing by colo volume is the closest thing to a cold/warm split
// this data allows, and it answers the question that decides what to optimise —
// whether the CPU is in the handler or in getting the isolate up.
const busiest = results[0]
if (busiest) {
  const byColo = await query(urlFilter(busiest.route), [
    { type: 'string', value: '$workers.event.request.cf.colo' },
  ])
  const colos = Object.values(byColo)
  const bucket = (min, max) => {
    const slice = colos.filter((c) => c.n >= min && c.n < max)
    const n = slice.reduce((total, c) => total + c.n, 0)
    const cpu = slice.reduce((total, c) => total + c.avg * c.n, 0) / (n || 1)
    return { colos: slice.length, n, cpu }
  }
  console.log(
    `\n${busiest.route} by colo volume (cold isolates are the small ones)`
  )
  for (const [min, max, label] of [
    [1, 3, 'saw 1-2'],
    [3, 10, 'saw 3-9'],
    [10, 100, 'saw 10-99'],
    [100, Infinity, 'saw 100+'],
  ]) {
    const b = bucket(min, max)
    if (b.n === 0) continue
    console.log(
      `  ${label.padEnd(10)} ${String(b.colos).padStart(3)} colos  ${String(b.n).padStart(6)} req  ${b.cpu.toFixed(2)}ms`
    )
  }
}

// Did the last deploy change anything?
//
// Every log line carries the script version that served it, and the versions
// API knows when each one went out — so the same route can be compared across
// deploys inside one window, without waiting for the old code to age out of it.
// This is the check to run after shipping a Worker change, and the one that
// stops "it feels faster" from becoming a commit message.
//
// Read it with the sample size in view: a version deployed ten minutes ago has
// served a few dozen requests, and the CPU field is whole milliseconds, so a
// difference under a few hundred microseconds is not visible yet.
if (busiest) {
  const versions = await deployedVersions()
  if (versions.length > 0) {
    const byVersion = await query(urlFilter(busiest.route), [
      { type: 'string', value: '$workers.scriptVersion.id' },
    ])
    console.log(`\n${busiest.route} by deploy (newest first)`)
    for (const version of versions.slice(0, 5)) {
      const stats = byVersion[version.id]
      if (!stats?.n) continue
      console.log(
        `  ${version.at}  ${version.id.slice(0, 8)}  ${String(stats.n).padStart(6)} req  ${stats.avg.toFixed(2)}ms  p99 ${stats.p99.toFixed(2)}ms`
      )
    }
  }
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
