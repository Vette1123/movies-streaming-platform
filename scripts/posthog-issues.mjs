#!/usr/bin/env node
/**
 * The error board — PostHog Error Tracking, read from raw $exception events so
 * nothing PostHog's UI groups away is missed (masareef/rafiq's posthog:issues).
 *
 *   pnpm posthog:issues                    open issues, last 14 days
 *   pnpm posthog:issues --days 30 --all    include resolved/suppressed/ledger
 *   pnpm posthog:issues show <id>          one issue: by day, by route, newest stack
 *   pnpm posthog:issues resolve <id> --note "what fixed it"
 *   pnpm posthog:issues suppress <id> --note "why it is noise"
 *   pnpm posthog:issues gate               exit 1 if anything is open (last 7 days)
 *
 * resolve/suppress take explicit ids and a mandatory note — there is no
 * "resolve all". Notes are APPENDED to the issue description, never replace it.
 * PostHog reopens a resolved issue on its next event; scripts/posthog-fixed.json
 * is the repo-side ledger that keeps a shipped fix hidden while old tabs drain
 * ({ "<id>": { "fixedOn": "YYYY-MM-DD", "what": "…", "commit": "…" } }).
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'

import { boardRows, firstOf, ownFrames } from './lib/board-filters.mjs'
import { phApi, phList, posthogConfig, runQuery } from './lib/posthog.mjs'

const LEDGER_PATH = new URL('./posthog-fixed.json', import.meta.url)

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const positional = args.filter(
  (arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--')
)
const [command = 'list', ...ids] = positional

const cfg = posthogConfig()

// Group by the issue's CURRENT id. `$exception_issue_id` is frozen at ingest
// and goes stale when issues are merged, so the fingerprint table is joined to
// find where each fingerprint lives now.
const groupedSql = (days, extra = '') => `
  SELECT coalesce(nullIf(toString(fp.issue_id), ''), toString(properties.$exception_issue_id)) AS id,
         argMax(properties.$exception_types, timestamp) AS types,
         argMax(properties.$exception_values, timestamp) AS messages,
         argMax(coalesce(properties.route, properties.$pathname), timestamp) AS route,
         argMax(properties.$exception_list, timestamp) AS exception_list,
         count() AS events, uniq(person_id) AS users,
         toString(min(timestamp)) AS first_seen, toString(max(timestamp)) AS last_seen
  FROM events
  LEFT JOIN (SELECT fingerprint, argMax(issue_id, first_seen) AS issue_id
             FROM system.error_tracking_issue_fingerprints GROUP BY fingerprint) AS fp
    ON fp.fingerprint = properties.$exception_fingerprint
  WHERE event = '$exception' AND timestamp > now() - INTERVAL ${Number(days)} DAY ${extra}
  GROUP BY id ORDER BY users DESC, events DESC LIMIT 1000`

async function statuses() {
  // The list endpoint ignores ?status=, so read every issue and filter here.
  const issues = await phList(cfg, '/error_tracking/issues/')
  return new Map(issues.map((issue) => [issue.id, issue.status]))
}

function readLedger() {
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  } catch {
    return {}
  }
}

const first = firstOf

async function list({ days, all, json, limit }) {
  const [rows, status] = await Promise.all([
    runQuery(cfg, groupedSql(days)),
    statuses(),
  ])
  if (rows.length >= 1000) {
    throw new Error('Hit the 1000-group ceiling — narrow --days.')
  }
  const { shown, hidden } = all
    ? { shown: rows, hidden: {} }
    : boardRows(rows, status, readLedger())

  if (json) {
    console.log(JSON.stringify({ shown, hidden }, null, 2))
    return shown
  }
  console.log(
    `\nError board — last ${days} days, ${shown.length} open of ${rows.length} grouped (${cfg.host}, project ${cfg.project})`
  )
  const hiddenText = Object.entries(hidden)
    .map(([reason, n]) => `${n} ${reason}`)
    .join(', ')
  if (hiddenText) console.log(`hidden: ${hiddenText}  (--all shows them)`)
  console.log('')
  for (const row of shown.slice(0, limit)) {
    console.log(
      `● ${first(row.types)}: ${String(first(row.messages)).slice(0, 140)}`
    )
    console.log(
      `  ${row.users} people · ${row.events} events · ${row.route ?? '-'} · last ${row.last_seen.slice(0, 16)} · ${status.get(row.id) ?? 'no-issue'} · ${row.id}`
    )
    if (!flag('--no-frames')) {
      for (const frame of ownFrames(row.exception_list)) {
        console.log(`    ${frame}`)
      }
    }
  }
  if (shown.length > limit)
    console.log(`\n… ${shown.length - limit} more (--limit)`)
  return shown
}

async function show(id, days) {
  const safe = String(id).replace(/[^a-z0-9-]/gi, '')
  const byDay = await runQuery(
    cfg,
    `SELECT toDate(timestamp) AS day, count() AS events, uniq(person_id) AS users
     FROM events WHERE event = '$exception' AND timestamp > now() - INTERVAL ${Number(days)} DAY
       AND toString(properties.$exception_issue_id) = '${safe}'
     GROUP BY day ORDER BY day DESC LIMIT 120`
  )
  const byRoute = await runQuery(
    cfg,
    `SELECT coalesce(properties.route, properties.$pathname) AS route, properties.$browser AS browser,
            count() AS events
     FROM events WHERE event = '$exception' AND timestamp > now() - INTERVAL ${Number(days)} DAY
       AND toString(properties.$exception_issue_id) = '${safe}'
     GROUP BY route, browser ORDER BY events DESC LIMIT 20`
  )
  const [issue] = await Promise.all([
    phApi(cfg, `/error_tracking/issues/${safe}/`).catch(() => null),
  ])
  console.log(
    `\n${issue?.name ?? 'issue'} — ${issue?.status ?? 'unknown status'} — ${safe}`
  )
  if (issue?.description) console.log(`\n${issue.description}\n`)
  console.log('by day:')
  for (const row of byDay)
    console.log(`  ${row.day}  ${row.events} events  ${row.users} people`)
  console.log('by route / browser:')
  for (const row of byRoute)
    console.log(`  ${row.route ?? '-'}  ${row.browser ?? '-'}  ${row.events}`)
  if (!byDay.length) {
    console.log(
      '  (no events in the window — the id may have been merged; check `list`)'
    )
  }
}

async function setStatus(targets, status, note) {
  if (!targets.length) throw new Error(`${status}: give one or more issue ids.`)
  if (!note) throw new Error(`${status}: --note "<why>" is required.`)
  const stamp = new Date().toISOString().slice(0, 10)
  for (const id of targets) {
    // Read first: a failed read must not become a blind write that erases the
    // triage notes already on the issue.
    const issue = await phApi(cfg, `/error_tracking/issues/${id}/`)
    const previous = issue.description
      ? `\n\n--- previously ---\n${issue.description}`
      : ''
    await phApi(cfg, `/error_tracking/issues/${id}/`, {
      method: 'PATCH',
      body: { status, description: `[${stamp} ${status}] ${note}${previous}` },
    })
    console.log(`${status}: ${id} (${issue.name})`)
  }
}

async function autocaptureOn() {
  // The project-level switch silently overrides the client's
  // capture_exceptions — when it is off, the board is empty and looks healthy.
  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!token) return null
  const res = await fetch(
    `https://eu-assets.i.posthog.com/array/${token}/config`
  )
  if (!res.ok) return null
  const config = await res.json()
  return config?.errorTracking?.autocaptureExceptions === true
}

try {
  const days = Number(option('--days', command === 'show' ? 90 : 14))
  if (command === 'list') {
    await list({
      days,
      all: flag('--all'),
      json: flag('--json'),
      limit: Number(option('--limit', 25)),
    })
  } else if (command === 'show') {
    await show(ids[0], days)
  } else if (command === 'resolve' || command === 'suppress') {
    await setStatus(
      ids,
      command === 'resolve' ? 'resolved' : 'suppressed',
      option('--note')
    )
  } else if (command === 'gate') {
    const on = await autocaptureOn()
    if (on === false) {
      console.error(
        '::error::Exception autocapture is OFF at project level — the board cannot see crashes.'
      )
      process.exit(1)
    }
    const open = await list({ days: 7, all: false, json: false, limit: 10 })
    if (open.length) {
      console.error(
        `\n::error::${open.length} open error issue(s) in the last 7 days.`
      )
      process.exit(1)
    }
    console.log('\ngate: no open issues, exception autocapture on.')
  } else {
    throw new Error(
      `Unknown command "${command}". list | show | resolve | suppress | gate`
    )
  }
} catch (error) {
  console.error(`::error::${error.message}`)
  process.exit(1)
}
