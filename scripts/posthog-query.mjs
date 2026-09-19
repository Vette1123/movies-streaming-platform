#!/usr/bin/env node
/**
 * Run a HogQL query against the project's PostHog and print the rows.
 *
 * This exists because the query it wraps was retyped from scrollback twice in
 * one session, and the second time it was retyped wrong: a plain synchronous
 * POST to `/query/` returns 504 "hit the max execution time" for any window
 * wider than about three days on this project, and the failure reads like an
 * outage rather than like a missing `refresh: 'async'`. The async handshake
 * plus its polling loop is the whole reason this is a file.
 *
 *   pnpm posthog:query "SELECT event, count() FROM events
 *                       WHERE timestamp > now() - INTERVAL 7 DAY GROUP BY event"
 *   pnpm posthog:query --dead-clicks
 *   pnpm posthog:query --errors
 *   pnpm posthog:query --events
 *
 * Host, project and key come from `.env.local` (see scripts/load-env.mjs), so
 * one copy of this serves whatever project the repo is pointed at.
 */
import process from 'node:process'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

// The bot block landed on 2026-09-02. Before it, ~63% of ingestion was a
// headless fleet at exactly 1280x720 and every aggregate that crosses the date
// is a measurement of scrapers, not of people. Named here so no caller has to
// remember it, and stated in the output so a number is never read as "all
// traffic since forever".
const HUMAN_TRAFFIC_SINCE = '2026-09-02'

const HOST = (
  process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com'
).replace(/\/$/, '')
const PROJECT = process.env.POSTHOG_PROJECT_ID || '216915'
const KEY = process.env.POSTHOG_API_KEY

// How long to wait for an async query before giving up, and how often to ask.
// A 14-day dead-click breakdown on this project lands in about 20s.
const POLL_MS = 2000
const POLL_LIMIT = 90

const PRESETS = {
  '--events': {
    label: 'events by volume, last 7 days',
    sql: `SELECT event, count() AS c
          FROM events
          WHERE timestamp > now() - INTERVAL 7 DAY
          GROUP BY event ORDER BY c DESC LIMIT 60`,
  },
  '--errors': {
    label: 'exceptions and api_error, last 7 days',
    sql: `SELECT event, properties.$exception_type AS type,
                 properties.$exception_message AS message,
                 properties.$current_url AS url, count() AS c
          FROM events
          WHERE timestamp > now() - INTERVAL 7 DAY
            AND event IN ('$exception', 'api_error')
          GROUP BY event, type, message, url ORDER BY c DESC LIMIT 40`,
  },
  '--dead-clicks': {
    label: 'dead clicks, dead swipes and rageclicks by element, last 14 days',
    sql: `SELECT event, properties.$pathname AS path,
                 substring(elements_chain, 1, 120) AS chain, count() AS c
          FROM events
          WHERE timestamp > now() - INTERVAL 14 DAY
            AND event IN ('$dead_click', '$rageclick', '$dead_swipe')
          GROUP BY event, path, chain ORDER BY c DESC LIMIT 40`,
  },
}

function usage(message) {
  if (message) console.error(`\n  ${message}\n`)
  console.error('  pnpm posthog:query "<HogQL>"')
  console.error(`  pnpm posthog:query ${Object.keys(PRESETS).join(' | ')}\n`)
  process.exit(message ? 1 : 0)
}

const arg = process.argv[2]
if (!arg || arg === '--help' || arg === '-h') usage()
if (!KEY) {
  usage(
    'POSTHOG_API_KEY is not set. Add it to .env.local — a personal API key, not the public ingest key.'
  )
}

const preset = PRESETS[arg]
if (arg.startsWith('--') && !preset) usage(`Unknown preset ${arg}.`)
const sql = preset ? preset.sql : arg

const headers = {
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

const post = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
  method: 'POST',
  headers,
  // `refresh: 'async'` is load-bearing, not an optimisation. Without it the
  // endpoint runs the query inline and returns 504 for any window wider than
  // roughly three days on this project's volume.
  body: JSON.stringify({
    query: { kind: 'HogQLQuery', query: sql },
    refresh: 'async',
  }),
})

let body = await post.json().catch(() => ({}))
if (!post.ok) {
  console.error(
    `::error::PostHog rejected the query (${post.status}): ${JSON.stringify(body).slice(0, 400)}`
  )
  process.exit(1)
}

const id = body.query_status?.id || body.id
for (let i = 0; i < POLL_LIMIT; i += 1) {
  const status = body.query_status || body
  if (status.complete || body.results) break
  if (!id) break
  await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  const poll = await fetch(`${HOST}/api/projects/${PROJECT}/query/${id}/`, {
    headers,
  })
  body = await poll.json().catch(() => ({}))
  const failure = body.query_status?.error || body.error
  if (failure) {
    console.error(
      `::error::PostHog query failed: ${body.query_status?.error_message || body.error_message || 'unknown'}`
    )
    process.exit(1)
  }
}

const payload = body.query_status?.results ?? body
const rows = payload.results || body.results
const columns = payload.columns || body.columns || []

// A query that never finished and a query that found nothing print the same
// empty table, and only one of them is an answer. Say which this was.
if (!rows) {
  console.error(
    `::error::Query did not finish within ${(POLL_LIMIT * POLL_MS) / 1000}s. Narrow the window and try again.`
  )
  process.exit(1)
}

const header = preset ? `${preset.label}` : 'custom query'
console.log(`\n${header} — ${HOST}, project ${PROJECT}`)
console.log(
  `windows crossing ${HUMAN_TRAFFIC_SINCE} include pre-bot-block traffic; before that date most sessions were scrapers\n`
)

const cell = (value) => {
  if (value === null || value === undefined) return '-'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 150 ? `${text.slice(0, 147)}...` : text
}

if (columns.length) console.log(columns.join(' | '))
for (const row of rows) console.log(row.map(cell).join(' | '))
console.log(`\n${rows.length} row${rows.length === 1 ? '' : 's'}`)
