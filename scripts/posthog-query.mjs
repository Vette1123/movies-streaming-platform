#!/usr/bin/env node
/**
 * Run a HogQL query against the project's PostHog and print the rows.
 *
 *   pnpm posthog:query "SELECT event, count() c FROM events
 *                       WHERE {humans} AND timestamp > now() - INTERVAL 7 DAY
 *                       GROUP BY event ORDER BY c DESC LIMIT 50"
 *   pnpm posthog:query --events | --errors | --dead-clicks | --routes
 *
 * `{humans}` expands to "after the bot block, not the test cohort" (see
 * scripts/lib/posthog.mjs). The async handshake, the polling and the
 * truncation check all live there too, shared with posthog:issues,
 * posthog:usage and posthog:setup.
 */
import process from 'node:process'

import {
  HUMAN_TRAFFIC_SINCE,
  posthogConfig,
  printTable,
  runQuery,
} from './lib/posthog.mjs'

const PRESETS = {
  '--events': {
    label: 'events by people and volume, last 7 days',
    sql: `SELECT event, uniq(person_id) AS people, count() AS c
          FROM events
          WHERE {humans} AND timestamp > now() - INTERVAL 7 DAY
          GROUP BY event ORDER BY people DESC LIMIT 200`,
  },
  '--errors': {
    label: 'exceptions and api_error, last 7 days',
    sql: `SELECT event, properties.$exception_type AS type,
                 coalesce(properties.$exception_message, properties.message) AS message,
                 properties.route AS route, count() AS c
          FROM events
          WHERE {humans} AND timestamp > now() - INTERVAL 7 DAY
            AND event IN ('$exception', 'api_error')
          GROUP BY event, type, message, route ORDER BY c DESC LIMIT 40`,
  },
  '--dead-clicks': {
    label: 'dead clicks, dead swipes and rageclicks by element, last 14 days',
    sql: `SELECT event, coalesce(properties.route, properties.$pathname) AS route,
                 substring(elements_chain, 1, 120) AS chain, count() AS c
          FROM events
          WHERE {humans} AND timestamp > now() - INTERVAL 14 DAY
            AND event IN ('$dead_click', '$rageclick', '$dead_swipe')
          GROUP BY event, route, chain ORDER BY c DESC LIMIT 40`,
  },
  '--routes': {
    label: 'pageviews by route template, last 7 days',
    sql: `SELECT properties.route AS route, uniq(person_id) AS people, count() AS views
          FROM events
          WHERE {humans} AND event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
          GROUP BY route ORDER BY people DESC LIMIT 60`,
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
const preset = PRESETS[arg]
if (arg.startsWith('--') && !preset) usage(`Unknown preset ${arg}.`)

try {
  const cfg = posthogConfig()
  const rows = await runQuery(cfg, preset ? preset.sql : arg)
  console.log(
    `\n${preset ? preset.label : 'custom query'} — ${cfg.host}, project ${cfg.project}`
  )
  console.log(
    `{humans} = after ${HUMAN_TRAFFIC_SINCE} and outside the test cohort; a query without it counts everything\n`
  )
  printTable(rows)
  console.log(`\n${rows.length} row${rows.length === 1 ? '' : 's'}`)
} catch (error) {
  console.error(`::error::${error.message}`)
  process.exit(1)
}
