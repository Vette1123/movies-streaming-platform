#!/usr/bin/env node
/**
 * Triage the GitHub issues PostHog's error tracking files.
 *
 * Every unique error PostHog sees becomes a GitHub issue, one per error
 * class. By 2026-10-20 that had left 66 open issues, of which three were
 * still live — the rest were errors that had been fixed months ago and were
 * only still "open" because nobody closed them. A tracker where 63 of 66
 * issues are dead is a tracker nobody reads, which is the same failure as a
 * health check that is permanently red.
 *
 * This closes the dead ones and leaves the live ones open, and says which
 * is which. It never closes an issue whose error PostHog has still seen
 * inside the window.
 *
 *   pnpm errors:triage            the plan, nothing closed
 *   pnpm errors:triage --apply    close the dead ones
 *   pnpm errors:triage --days 30  a wider window (default 7)
 *
 * What it reads:
 *   - the open issues, through the `gh` CLI (so the GitHub token stays in
 *     `gh`'s own store and never enters this repo)
 *   - the errors PostHog has seen, through the REST API — the same channel
 *     scripts/posthog-query.mjs uses, for the same reason: the PostHog MCP
 *     is pinned to the wrong region and cannot be switched.
 *
 * Its limits, stated so nobody is surprised:
 *   - it matches on the error MESSAGE, which is what the issue body carries.
 *     Two different errors with the same message are one error to it.
 *   - an error PostHog stopped sending because the FILTER dropped it (see
 *     lib/error-noise.ts) reads as "dead" — which is what we want: the fix
 *     was the filter.
 *   - it does not read the issue's comments, and it never reopens anything.
 */
import { execFileSync } from 'node:child_process'
import process from 'node:process'

import { posthogConfig, runQuery } from './lib/posthog.mjs'

const KEY = process.env.POSTHOG_API_KEY
const REPO =
  process.env.GITHUB_REPOSITORY || 'Vette1123/movies-streaming-platform'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const daysIndex = args.indexOf('--days')
const DAYS = daysIndex >= 0 ? Number(args[daysIndex + 1]) || 7 : 7

if (!KEY) {
  console.error(
    'POSTHOG_API_KEY is not set. Add it to .env.local — a personal API key, not the public ingest key.'
  )
  process.exit(1)
}

/** The error message an issue is about: the first line of its body. */
const messageOf = (body) =>
  (body ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('[View in PostHog]')) ?? ''

async function posthogMessages() {
  // Both kinds of event: an uncaught error (which is what files an issue) and
  // an API failure (the react-query reporter's own event, which some issues
  // are about). The message is the join key in both.
  //
  // The LIMIT is load-bearing: without one HogQL silently stops at 100 rows,
  // and every live message past the 100th would read as dead and be closed.
  // runQuery throws if even this is truncated.
  const sql = `SELECT DISTINCT if(event = '$exception', properties.\`$exception_list\`[1].value, properties.message) AS message
    FROM events
    WHERE timestamp > now() - INTERVAL ${DAYS} DAY AND event IN ('$exception', 'api_error')
    LIMIT 10000`
  const rows = await runQuery(posthogConfig(), sql)
  return new Set(
    rows
      .map((row) => row.message)
      .filter((value) => typeof value === 'string' && value.length)
  )
}

const gh = (args) =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

const live = await posthogMessages()
console.log(
  `\n  PostHog has seen ${live.size} distinct error message(s) in the last ${DAYS} day(s).`
)

const issues = JSON.parse(
  gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,title,body,createdAt',
  ])
)

const dead = []
const stillLive = []
for (const issue of issues) {
  const message = messageOf(issue.body)
  if (message && live.has(message)) stillLive.push({ ...issue, message })
  else dead.push({ ...issue, message })
}

console.log(
  `  ${issues.length} open issue(s): ${stillLive.length} still live, ${dead.length} dead.\n`
)

if (stillLive.length) {
  console.log('  STILL LIVE — left open:')
  for (const issue of stillLive) {
    console.log(`    #${issue.number}  ${issue.message}`)
  }
  console.log('')
}

if (!dead.length) {
  console.log('  Nothing to close.\n')
  process.exit(0)
}

console.log('  DEAD — the error has not been seen in the window:')
for (const issue of dead.slice(0, 12)) {
  console.log(`    #${issue.number}  ${issue.message || issue.title}`)
}
if (dead.length > 12) console.log(`    … and ${dead.length - 12} more`)

if (!apply) {
  console.log('\n  Dry run. Re-run with --apply to close them.\n')
  process.exit(0)
}

let closed = 0
for (const issue of dead) {
  const note = `Closing: PostHog has not seen this error in the last ${DAYS} day(s), so the fix is already live. Reopens automatically if it comes back.`
  try {
    gh([
      'issue',
      'comment',
      String(issue.number),
      '--repo',
      REPO,
      '--body',
      note,
    ])
    gh([
      'issue',
      'close',
      String(issue.number),
      '--repo',
      REPO,
      '--reason',
      'completed',
    ])
    closed++
  } catch (error) {
    console.error(`  could not close #${issue.number}: ${error.message}`)
  }
}
console.log(`\n  Closed ${closed} issue(s).\n`)
