#!/usr/bin/env node
/**
 * Apply scripts/posthog-dashboards.mjs to the live PostHog project.
 *
 *   pnpm posthog:setup            create/update dashboards, tiles, alerts, settings
 *   pnpm posthog:setup --dry-run  print what it would do
 *
 * Idempotent: everything is matched by name and updated in place, so re-run it
 * after any edit to the spec. Also turns on the test-account filter for every
 * existing Trends/Funnel insight in the project — the original 37 tiles all
 * counted our own browsers.
 *
 * Needs a personal key with dashboard, insight, alert and project write
 * scopes (the full list is in ~/.claude/rules/posthog.md).
 */
import process from 'node:process'

import {
  enforceTestFilter,
  loadState,
  upsertAlert,
  upsertDashboard,
  upsertInsight,
} from './lib/posthog-insights.mjs'
import { phApi, phList, posthogConfig, runQuery } from './lib/posthog.mjs'
import { ALERTS, DASHBOARDS, PROJECT_SETTINGS } from './posthog-dashboards.mjs'

const dryRun = process.argv.includes('--dry-run')
const cfg = posthogConfig()
const tally = { created: 0, updated: 0, filtered: 0, alerts: 0 }
const note = (result) => {
  if (result.created) tally.created += 1
  else tally.updated += 1
}

try {
  if (process.argv.includes('--check')) {
    // Every HogQL tile against real data before trusting it (rafiq's lesson:
    // a guessed property name is a silent column of nulls).
    let failed = 0
    for (const board of DASHBOARDS) {
      for (const tile of board.tiles) {
        if (tile.query.kind !== 'DataVisualizationNode') continue
        try {
          const rows = await runQuery(cfg, tile.query.source.query)
          const columns = rows.length ? Object.keys(rows[0]) : []
          const empty = columns.filter((c) => rows.every((r) => r[c] === null))
          const flagText = empty.length ? `  ALL-NULL: ${empty.join(', ')}` : ''
          console.log(
            `${rows.length ? 'ok  ' : 'EMPTY'} ${rows.length} rows  ${tile.name}${flagText}`
          )
        } catch (error) {
          failed += 1
          console.log(`FAIL ${tile.name}: ${error.message}`)
        }
      }
    }
    process.exit(failed ? 1 : 0)
  }

  if (dryRun) {
    for (const board of DASHBOARDS) {
      console.log(`${board.name}: ${board.tiles.length} tiles`)
      for (const tile of board.tiles) console.log(`  - ${tile.name}`)
    }
    console.log(`alerts: ${ALERTS.map((a) => a.name).join(' | ')}`)
    process.exit(0)
  }

  const state = await loadState(cfg)
  const ids = {}
  for (const board of DASHBOARDS) {
    const { id, created } = await upsertDashboard(cfg, state, board)
    ids[board.key] = id
    console.log(
      `${created ? 'created' : 'updated'} dashboard ${board.name} (${id})`
    )
    for (const tile of board.tiles) {
      const result = await upsertInsight(cfg, state, id, tile)
      note(result)
      console.log(`  ${result.created ? '+' : '~'} ${tile.name}`)
    }
  }

  // Alerts need a subscriber, and reading /users/@me needs a scope the key
  // does not have — the person who made the existing insights is the owner.
  const subscriberId = state.insights.find((i) => i.created_by?.id)?.created_by
    ?.id
  const existingAlerts = await phList(cfg, '/alerts/')
  for (const alert of ALERTS) {
    const insight = await upsertInsight(cfg, state, ids.weekly, alert.tile)
    note(insight)
    try {
      const result = await upsertAlert(cfg, existingAlerts, {
        ...alert,
        insightId: insight.id,
        subscriberId,
      })
      tally.alerts += 1
      console.log(
        `${result.created ? 'created' : 'updated'} alert ${alert.name}`
      )
    } catch (error) {
      console.error(
        `::warning::alert "${alert.name}" not applied: ${error.message}`
      )
    }
  }

  // The old tiles counted test accounts. Every insight in the project, not
  // just ours: a dashboard someone builds by hand later should not either.
  const all = await phList(cfg, '/insights/?saved=true')
  for (const insight of all) {
    if (await enforceTestFilter(cfg, insight)) tally.filtered += 1
  }

  await phApi(cfg, '/', {
    method: 'PATCH',
    body: {
      ...PROJECT_SETTINGS,
      primary_dashboard: ids[DASHBOARDS.find((b) => b.primary).key],
    },
  })
  console.log('updated project name, description and home dashboard')

  console.log(
    `\ndone: ${tally.created} tiles created, ${tally.updated} updated, ${tally.alerts}/${ALERTS.length} alerts, test filter turned on for ${tally.filtered} older insights`
  )
  for (const board of DASHBOARDS) {
    console.log(
      `  ${board.name}: ${cfg.host}/project/${cfg.project}/dashboard/${ids[board.key]}`
    )
  }
} catch (error) {
  console.error(`::error::${error.message}`)
  process.exit(1)
}
