// Production health check for the Cloudflare deployment. Read-only.
//
//   pnpm cf:health            last 24h
//   pnpm cf:health 3          last 3h
//
// This exists because the Cloudflare dashboard cannot answer "is the site
// healthy" for this architecture, and reading it wrong has cost real debugging
// time twice. Two traps it encodes:
//
// 1. MOST 5xx IN THE ZONE ARE NOT REAL. Requests carry a `requestSource`, and
//    only `eyeball` is a browser. The rest are Cloudflare's own internal
//    machinery, which logs synthetic statuses:
//      - `edgeWorkerCacheAPI` — the Worker's `caches.default` bookkeeping
//        (cloudflare/worker.js `cached()`): a match MISS logs 504 and the put
//        logs 204, paired on the same path. Permanent and harmless.
//      - `earlyHintsCache` — was ~23k phantom 504s/day until Early Hints was
//        turned off (see scripts/cf-waf-setup.mjs).
//    A 2026-08-03 audit spent 20 minutes proving the 25%-failure dashboard was
//    entirely this. Hence: 5xx is reported eyeball-only.
//
// 2. CPU IS AN ACCOUNT-LEVEL DATASET. Page views are static assets and never
//    invoke the Worker, so zone traffic says nothing about the 10ms CPU budget.
//    `workersInvocationsAdaptive` is the only place kills are visible. NOTE the
//    token in .env.local is zone-scoped for most things: `viewer{accounts{...}}`
//    is rejected unless it is filtered by `accountTag`, which is why an
//    unfiltered query looks like an empty result rather than an auth error.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ZONE_NAME = process.env.CF_ZONE_NAME || 'reely.space'
const HOURS = Number(process.argv[2]) || 24

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN (or put it in .env.local).')
  process.exit(1)
}

// Account id and script name come from wrangler.jsonc so this can never drift
// from what is actually deployed. Regex rather than a JSONC parser: two fields.
const wrangler = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')
const field = (name) =>
  wrangler.match(new RegExp(`"${name}":\\s*"([^"]+)"`))?.[1]
const ACCOUNT_ID = field('account_id')
const SCRIPT_NAME = field('name')

// Free-plan ceilings. Exceeding these is what takes the site down, so they are
// the thresholds the check grades against.
const LIMITS = {
  invocationsPerDay: 100_000,
  subrequestsPerInvocation: 50,
  cpuMsPerInvocation: 10,
}

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z')
const now = Date.now()
const SINCE = iso(now - HOURS * 3600e3)
const UNTIL = iso(now)

async function gql(query) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.json()
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join(' | '))
  }
  return body.data.viewer
}

async function zoneId() {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(ZONE_NAME)}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  )
  const body = await res.json()
  if (!body.result?.length) throw new Error(`Zone not found: ${ZONE_NAME}`)
  return body.result[0].id
}

const pct = (part, whole) => (whole ? (100 * part) / whole : 0)
const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0)

/**
 * `true` passes, `false` fails the run, `'warn'` prints but does not fail.
 *
 * The warn state exists because the useful signal for a resource budget arrives
 * before the budget is spent: a check that only fires at 100% tells you about an
 * outage you already had. Anything on a free-plan ceiling gets a margin band.
 */
const results = []
const MARK = { true: '✓', false: '✗', warn: '!' }
function grade(status, label, detail) {
  results.push({ status, label, detail })
  console.log(`${MARK[status]} ${label}\n    ${detail}`)
}

/** Pass under `warnAt`, warn between `warnAt` and `limit`, fail at `limit`. */
const band = (value, warnAt, limit) => {
  if (value >= limit) return false
  if (value >= warnAt) return 'warn'
  return true
}

/** Worker CPU, invocation count and kills — the free-plan budget. */
async function checkWorker() {
  const filter = `datetime_geq:"${SINCE}",datetime_leq:"${UNTIL}",scriptName:"${SCRIPT_NAME}"`
  const { accounts } =
    await gql(`query{viewer{accounts(filter:{accountTag:"${ACCOUNT_ID}"}){
    byStatus: workersInvocationsAdaptive(limit:1000,filter:{${filter}}){
      dimensions{status} sum{requests errors subrequests}}
    ok: workersInvocationsAdaptive(limit:100,filter:{${filter},status:"success"}){
      sum{requests subrequests} quantiles{cpuTimeP50 cpuTimeP99 cpuTimeP999 wallTimeP99}}}}}`)

  const byStatus = accounts[0].byStatus
  const invocations = sum(byStatus, (r) => r.sum.requests)
  if (!invocations) {
    grade(true, 'Worker: no invocations in window', 'nothing to grade')
    return
  }

  const counts = {}
  for (const row of byStatus) {
    counts[row.dimensions.status] =
      (counts[row.dimensions.status] ?? 0) + row.sum.requests
  }
  // clientDisconnected is the eyeball leaving mid-flight — not our failure.
  const killed =
    (counts.exceededResources ?? 0) +
    (counts.exceededMemory ?? 0) +
    (counts.exceededCpu ?? 0) +
    (counts.scriptThrewException ?? 0)

  const perDay = (invocations / HOURS) * 24
  const ok = accounts[0].ok[0]
  const cpu = (key) => (ok ? ok.quantiles[key] / 1000 : 0)
  const subPer = ok?.sum.requests ? ok.sum.subrequests / ok.sum.requests : 0

  grade(
    killed === 0,
    `Worker kills: ${killed} of ${invocations} invocations (${pct(killed, invocations).toFixed(3)}%)`,
    JSON.stringify(counts)
  )
  // CPU warns but never fails, and the reason is worth writing down: the free
  // plan's nominal budget is 10ms per invocation, yet p999 sat at 10-12ms for
  // hours with exactly zero kills — Cloudflare is evidently not enforcing it as
  // a hard per-invocation cap here. Failing on the nominal number would report an
  // outage the site is not having, while the kill count above is direct evidence
  // either way. So this is a margin gauge: watch it move, do not gate on it.
  const budget = LIMITS.cpuMsPerInvocation
  grade(
    cpu('cpuTimeP99') < budget * 0.8 ? true : 'warn',
    `Worker CPU: p50 ${cpu('cpuTimeP50').toFixed(2)}ms, p99 ${cpu('cpuTimeP99').toFixed(2)}ms, p999 ${cpu('cpuTimeP999').toFixed(2)}ms`,
    `nominal budget ${budget}ms — a gauge, not a gate (kills are the gate); warns over ${budget * 0.8}ms p99`
  )
  grade(
    band(perDay, LIMITS.invocationsPerDay * 0.7, LIMITS.invocationsPerDay),
    `Invocations: ${Math.round(perDay).toLocaleString()}/day projected (${pct(perDay, LIMITS.invocationsPerDay).toFixed(0)}% of cap)`,
    'static assets are exempt, so this counts only /api/* + tail-id fallbacks'
  )
  grade(
    band(
      subPer,
      LIMITS.subrequestsPerInvocation * 0.4,
      LIMITS.subrequestsPerInvocation
    ),
    `Subrequests: ${subPer.toFixed(2)} per invocation`,
    `cap ${LIMITS.subrequestsPerInvocation} — the cap that broke the homepage when IMDb enrichment was on`
  )
}

/** What browsers actually got. The only 5xx number that means anything. */
async function checkEyeball(zone) {
  const filter = `datetime_geq:"${SINCE}",datetime_leq:"${UNTIL}",requestSource:"eyeball"`
  const { zones } = await gql(`query{viewer{zones(filter:{zoneTag:"${zone}"}){
    httpRequestsAdaptiveGroups(limit:60,filter:{${filter}},orderBy:[count_DESC]){
      count dimensions{edgeResponseStatus}}}}}`)
  const rows = zones[0].httpRequestsAdaptiveGroups
  const total = sum(rows, (r) => r.count)
  const server = rows.filter((r) => r.dimensions.edgeResponseStatus >= 500)
  const failures = sum(server, (r) => r.count)

  grade(
    failures === 0,
    `Eyeball 5xx: ${failures} of ${total.toLocaleString()} real requests (${pct(failures, total).toFixed(3)}%)`,
    server.length
      ? server
          .map((r) => `${r.dimensions.edgeResponseStatus}×${r.count}`)
          .join(' ')
      : 'internal requestSources (edgeWorkerCacheAPI / earlyHintsCache) excluded — see header comment'
  )
  return total
}

/**
 * Search crawlers that actually drive organic traffic. Anything else calling
 * itself a bot (PerplexityBot, SERanking, scrapers) is SUPPOSED to be challenged
 * — being strict with those is the point of the WAF, so they are not graded.
 */
const SEO_CRAWLERS =
  /Googlebot|bingbot|DuckDuckBot|YandexBot|Applebot|PetalBot/i

/**
 * What the search crawlers got — the one error class whose cost is invisible in
 * the app itself.
 *
 * A 404 here is fine and expected: crawlers replay dead URLs for months and 404
 * is the honest answer. A 403 is not — Search Console files it as "Blocked due
 * to access forbidden", which is a worse signal than the truth, and a 5xx makes
 * Google slow its crawl rate. Both are invisible to every other check in this
 * script, because the pages a human visits are fine.
 *
 * This exists because on 2026-08-03 a hand-written query found Googlebot-Image
 * and bingbot each taking ~14 403s/day from the dead-extension WAF rule, which
 * had been added the same day and matched before the verified-bot allowlist.
 */
async function checkCrawlers(zone) {
  const filter = `datetime_geq:"${SINCE}",datetime_leq:"${UNTIL}",requestSource:"eyeball",edgeResponseStatus_geq:400`
  const { zones } = await gql(`query{viewer{zones(filter:{zoneTag:"${zone}"}){
    httpRequestsAdaptiveGroups(limit:2000,filter:{${filter}},orderBy:[count_DESC]){
      count dimensions{userAgent edgeResponseStatus}}}}}`)

  const offenders = new Map()
  for (const row of zones[0].httpRequestsAdaptiveGroups) {
    const { userAgent, edgeResponseStatus: status } = row.dimensions
    if (!SEO_CRAWLERS.test(userAgent ?? '')) continue
    // 404 is the correct answer to a request for something that isn't there.
    if (status !== 403 && status < 500) continue
    const name = SEO_CRAWLERS.exec(userAgent)[0]
    const key = `${name} ${status}`
    offenders.set(key, (offenders.get(key) ?? 0) + row.count)
  }

  const total = sum(
    [...offenders.values()].map((n) => ({ n })),
    (r) => r.n
  )
  grade(
    total === 0,
    `Search crawlers: ${total} blocked/failed requests to Googlebot &c.`,
    offenders.size
      ? [...offenders].map(([key, count]) => `${key}×${count}`).join(' ')
      : '403s and 5xx only — 404 is the correct answer to a dead URL and is not counted'
  )
}

/**
 * Eyeball 4xx, bucketed. Every bucket here has been traced to a benign cause;
 * they are printed so a NEW one stands out instead of hiding in the tail.
 */
const BUCKETS = [
  [
    'bot: blocked scrapers (/sw.js is HeadlessChrome, working as designed)',
    /^\/sw\.js$/,
  ],
  ['bot: PHP/WordPress probes', /wp-|\.php$|\.env|\/admin/i],
  // Bare TMDB paths, plus the fragments a naive crawler produces by splitting an
  // ImageKit srcset URL on the commas inside it: "/tr:w-500,q-82,f-auto/w500/x.jpg"
  // becomes a request for "/f-auto/w500/x.jpg". Every image URL the site actually
  // emits is absolute and correct, so 404 is the right answer to all of these.
  //
  // The fragment is matched ANYWHERE in the path, not just at the root: a crawler
  // that resolves the same fragment relative to the page it found it on asks for
  // "/movies/f-auto/w500/x.jpg". Measured 2026-08-03 — anchoring at "^/" left
  // those in the unclassified column, which is the one column meant to be signal.
  [
    'bot: image crawler on stale/mis-split URLs',
    /^\/[A-Za-z0-9_-]{20,32}\.(jpg|png)$|\/(f-auto|f-webp|pr-true|q-\d+)\//,
  ],
  [
    'bot: doubled path from bad referrers',
    /^\/(movies|tv-shows)\/\d+\/(movies|tv-shows)\/\d+/,
  ],
  ['stale-deploy clients (chunk 404 → client reload)', /^\/_next\/static\//],
  ['prefetch of non-prerendered id (page itself works)', /__next\._/],
  // A crawler appending .txt/.xml to a real route, guessing at a plain-text or
  // sitemap twin that this site never published.
  ['bot: guessed .txt/.xml twin of a real route', /\.(txt|xml)$/],
  // Cloudflare's own RUM beacon POSTs here. Under `output: 'export'` there is
  // nothing to answer it, so the asset handler returns 405. Harmless — RUM is
  // not a data source we use (see scripts/cf-health.mjs; PostHog does web vitals).
  ['cloudflare RUM beacon (405, unused)', /^\/cdn-cgi\//],
  // Guessed conventional paths that were never routes here. The CMS-flavoured
  // names (wordpress/cms/feed/site/main) come from the same scanners as the
  // .php probes above, just without an extension to give them away.
  [
    'bot: guessed conventional path',
    /^\/(static|wp|new|blog|assets|include|files|wordpress|cms|feed|site|main)\//,
  ],
  // Chrome asks every origin for this before using the private prefetch proxy.
  // Not a bot and not an error — 404 means "no opinion", which is the answer we
  // want. It recurs daily, so it is classified rather than left as noise.
  ['chrome private prefetch proxy probe', /^\/\.well-known\/traffic-advice$/],
]

/**
 * Statuses that are benign for a structural reason rather than a path pattern.
 * Tried only AFTER the path buckets above, so `/sw.js` stays "blocked scrapers"
 * instead of collapsing into the generic 403 row.
 *
 * 403 — nothing in this architecture can emit one. The Worker's own statuses are
 *   200/400/404/405/500 (cloudflare/worker.js), and Workers Static Assets answers
 *   200/304/404/405. So every 403 on this zone was produced by Cloudflare ahead
 *   of the origin: our WAF rules, or the zone security level challenging a bad
 *   reputation IP. Sampled 2026-08-03 — PerplexityBot, coccocbot, Go-http-client
 *   on /favicon.ico, and a UA-spoofing scanner POSTing to /. All working as
 *   designed. A real user wrongly blocked would show up as this bucket jumping,
 *   and a blocked *search* crawler already fails checkCrawlers() above.
 * 405 — a non-GET to a GET-only path. Bots POST at detail pages, and tabs still
 *   running the pre-static-export bundle retry a Server Action POST against the
 *   page URL, which is now a plain asset. Both are correct 405s.
 * 499 — the client hung up before the response was written. Not our failure.
 */
const STATUS_BUCKETS = [
  ['edge-blocked/challenged by Cloudflare (403, by design)', 403],
  ['non-GET to a GET-only path (bots + stale Server Action tabs)', 405],
  ['client disconnected mid-request (499)', 499],
]

const bucketFor = ({ clientRequestPath, edgeResponseStatus }) =>
  BUCKETS.find(([, re]) => re.test(clientRequestPath))?.[0] ??
  STATUS_BUCKETS.find(([, status]) => status === edgeResponseStatus)?.[0]

async function checkClientErrors(zone) {
  const filter = `datetime_geq:"${SINCE}",datetime_leq:"${UNTIL}",requestSource:"eyeball",edgeResponseStatus_geq:400,edgeResponseStatus_lt:500`
  const { zones } = await gql(`query{viewer{zones(filter:{zoneTag:"${zone}"}){
    httpRequestsAdaptiveGroups(limit:2000,filter:{${filter}},orderBy:[count_DESC]){
      count dimensions{clientRequestPath edgeResponseStatus}}}}}`)

  const tally = new Map()
  const unknown = []
  for (const row of zones[0].httpRequestsAdaptiveGroups) {
    const key = bucketFor(row.dimensions)
    if (!key) {
      unknown.push(row)
      continue
    }
    tally.set(key, (tally.get(key) ?? 0) + row.count)
  }

  console.log('\n  eyeball 4xx, known-benign:')
  for (const [label, count] of [...tally].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(6)}  ${label}`)
  }
  const unknownTotal = sum(unknown, (r) => r.count)
  console.log(
    `\n  eyeball 4xx, unclassified: ${unknownTotal} — the only column worth reading closely`
  )
  for (const row of unknown.slice(0, 12)) {
    console.log(
      `    ${String(row.count).padStart(6)}  ${row.dimensions.edgeResponseStatus} ${row.dimensions.clientRequestPath.slice(0, 80)}`
    )
  }
}

/**
 * Hour-by-hour kills and eyeball 5xx, printed only when something failed.
 *
 * "Is this a live regression, or does my window just span a fix?" is always the
 * next question, and a 24h aggregate cannot answer it — the run right after the
 * static-export deploy failed on 7,670 real 503s that had all stopped hours
 * earlier. One glance at the timeline settles it.
 */
async function showTimeline(zone) {
  const window = `datetime_geq:"${SINCE}",datetime_leq:"${UNTIL}"`
  const [{ accounts }, { zones }] = await Promise.all([
    gql(`query{viewer{accounts(filter:{accountTag:"${ACCOUNT_ID}"}){
      workersInvocationsAdaptive(limit:1000,filter:{${window},scriptName:"${SCRIPT_NAME}"},orderBy:[datetimeHour_ASC]){
        dimensions{datetimeHour status} sum{requests}}}}}`),
    gql(`query{viewer{zones(filter:{zoneTag:"${zone}"}){
      httpRequestsAdaptiveGroups(limit:1000,filter:{${window},requestSource:"eyeball",edgeResponseStatus_geq:500},orderBy:[datetimeHour_ASC]){
        count dimensions{datetimeHour}}}}}`),
  ])

  const hours = new Map()
  const at = (hour) => {
    if (!hours.has(hour))
      hours.set(hour, { invocations: 0, killed: 0, http5xx: 0 })
    return hours.get(hour)
  }
  const KILL_STATUSES = new Set([
    'exceededResources',
    'exceededMemory',
    'exceededCpu',
    'scriptThrewException',
  ])
  for (const row of accounts[0].workersInvocationsAdaptive) {
    const hour = at(row.dimensions.datetimeHour)
    hour.invocations += row.sum.requests
    if (KILL_STATUSES.has(row.dimensions.status))
      hour.killed += row.sum.requests
  }
  for (const row of zones[0].httpRequestsAdaptiveGroups) {
    at(row.dimensions.datetimeHour).http5xx += row.count
  }

  console.log('\n  hour (UTC)         invocations  killed   eyeball 5xx')
  for (const [hour, v] of [...hours].sort()) {
    const flag = v.killed || v.http5xx ? ' ←' : ''
    console.log(
      `    ${hour.slice(0, 16)}  ${String(v.invocations).padStart(9)}  ${String(v.killed).padStart(6)}  ${String(v.http5xx).padStart(11)}${flag}`
    )
  }
}

const zone = await zoneId()
console.log(
  `${ZONE_NAME} / ${SCRIPT_NAME} — last ${HOURS}h (${SINCE} → ${UNTIL})\n`
)
await checkWorker()
await checkEyeball(zone)
await checkCrawlers(zone)
await checkClientErrors(zone)

const failed = results.filter((r) => r.status === false)
const warned = results.filter((r) => r.status === 'warn')
if (failed.length) await showTimeline(zone)

const names = (rows) => rows.map((r) => r.label.split(':')[0]).join(', ')
if (failed.length) {
  console.log(`\n✗ ${failed.length} check(s) failed: ${names(failed)}`)
} else if (warned.length) {
  console.log(
    `\n! ${results.length - warned.length}/${results.length} clear, approaching a ceiling: ${names(warned)}`
  )
} else {
  console.log(`\n✓ all ${results.length} checks passed`)
}
process.exit(failed.length ? 1 : 0)
