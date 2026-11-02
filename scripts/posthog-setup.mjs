#!/usr/bin/env node
/**
 * Apply scripts/posthog-dashboards.mjs to the live PostHog project.
 *
 *   pnpm posthog:setup            create/update dashboards, tiles, alerts, settings
 *   pnpm posthog:setup --dry-run  print each board's grid layout
 *   pnpm posthog:setup --check    run every tile (HogQL, Trends, Funnels...) on real data
 *
 * Idempotent: everything is matched by name and updated in place, so re-run it
 * after any edit to the spec. The spec OWNS its three boards: each is laid out
 * in spec order (section headers, sizes) and a tile it does not name is taken
 * off (the insight stays in the project library). Also turns on the
 * test-account filter for every existing Trends/Funnel insight in the project.
 *
 * A changed project test-account filter does not invalidate PostHog's cached
 * tile results: press Refresh on the dashboard once after changing it.
 *
 * Needs a personal key with dashboard, insight, alert and project write
 * scopes (the full list is in ~/.claude/rules/posthog.md).
 */
import process from 'node:process'

import {
  enforceTestFilter,
  layoutTiles,
  loadState,
  syncDashboardTiles,
  upsertAlert,
  upsertDashboard,
  upsertInsight,
} from './lib/posthog-insights.mjs'
import { phApi, phList, posthogConfig, runNode } from './lib/posthog.mjs'
import { ALERTS, DASHBOARDS, PROJECT_SETTINGS } from './posthog-dashboards.mjs'

const dryRun = process.argv.includes('--dry-run')
const cfg = posthogConfig()
const tally = { created: 0, updated: 0, removed: 0, filtered: 0, alerts: 0 }
const note = (result) => {
  if (result.created) tally.created += 1
  else tally.updated += 1
}

/** True when a Trends/Funnel/Retention result holds no number above zero. */
const allZero = (value) => {
  if (typeof value === 'number') return value === 0
  if (Array.isArray(value)) return value.every(allZero)
  if (value && typeof value === 'object') {
    const numbers = ['count', 'aggregated_value', 'data', 'values', 'people']
      .filter((k) => k in value)
      .map((k) => value[k])
    return numbers.every(allZero)
  }
  return true
}

async function checkTile(tile) {
  const node = tile.query.source
  const { rows, columns } = await runNode(cfg, node)
  if (node.kind === 'HogQLQuery') {
    const empty = columns.filter((_, i) => rows.every((r) => r[i] === null))
    const flagText = empty.length ? `  ALL-NULL: ${empty.join(', ')}` : ''
    return `${rows.length ? 'ok   ' : 'EMPTY'} ${String(rows.length).padStart(3)} rows  ${tile.name}${flagText}`
  }
  return `${allZero(rows) ? 'ZERO ' : 'ok   '} ${String(rows.length).padStart(3)} series ${tile.name}`
}

try {
  if (process.argv.includes('--check')) {
    // Every tile against real data before trusting it (rafiq's lesson: a
    // guessed property name is a silent column of nulls). HogQL tiles report
    // all-null columns; Trends/Funnels/Retention report an all-zero result.
    let failed = 0
    for (const board of DASHBOARDS) {
      console.log(`\n${board.name}`)
      for (const tile of board.tiles.filter((t) => t.query)) {
        try {
          console.log(await checkTile(tile))
        } catch (error) {
          failed += 1
          console.log(`FAIL  ${tile.name}: ${error.message}`)
        }
      }
    }
    console.log(failed ? `\n${failed} tiles failed` : '\nevery tile ran')
    process.exit(failed ? 1 : 0)
  }

  if (dryRun) {
    for (const board of DASHBOARDS) {
      console.log(`${board.name}:`)
      for (const { item, layout } of layoutTiles(board.tiles)) {
        const at = `${layout.x},${layout.y} ${layout.w}x${layout.h}`.padEnd(12)
        console.log(
          `  ${at} ${item.section ? `## ${item.section}` : item.name}`
        )
      }
    }
    console.log(`alerts: ${ALERTS.map((a) => a.name).join(' | ')}`)
    process.exit(0)
  }

  const state = await loadState(cfg)
  const ids = {}
  const insightIds = new Map()
  // Dashboards first: a tile can sit on several boards, and its insight is
  // written once with every board the spec names it on.
  const boardsOf = new Map()
  for (const board of DASHBOARDS) {
    const { id, created } = await upsertDashboard(cfg, state, board)
    ids[board.key] = id
    console.log(
      `${created ? 'created' : 'updated'} dashboard ${board.name} (${id})`
    )
    for (const tile of board.tiles.filter((t) => t.query)) {
      boardsOf.set(tile.name, [...(boardsOf.get(tile.name) ?? []), id])
    }
  }
  for (const board of DASHBOARDS) {
    for (const tile of board.tiles.filter((t) => t.query)) {
      if (insightIds.has(tile.name)) continue
      const result = await upsertInsight(
        cfg,
        state,
        boardsOf.get(tile.name),
        tile
      )
      note(result)
      insightIds.set(tile.name, result.id)
      console.log(`  ${result.created ? '+' : '~'} ${tile.name}`)
    }
  }
  for (const board of DASHBOARDS) {
    const id = ids[board.key]
    const removed = await syncDashboardTiles(
      cfg,
      id,
      layoutTiles(board.tiles),
      insightIds
    )
    tally.removed += removed
    console.log(`  laid out; ${removed} tiles not in the spec taken off`)
  }

  // Alerts need a subscriber, and reading /users/@me needs a scope the key
  // does not have — the person who made the existing insights is the owner.
  // Each alert's insight is a tile on a board (the spec places it).
  const subscriberId = state.insights.find((i) => i.created_by?.id)?.created_by
    ?.id
  const existingAlerts = await phList(cfg, '/alerts/')
  for (const alert of ALERTS) {
    const insight = { id: insightIds.get(alert.tile.name) }
    if (!insight.id) {
      throw new Error(`alert "${alert.name}": its tile is on no dashboard`)
    }
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
    `\ndone: ${tally.created} tiles created, ${tally.updated} updated, ${tally.removed} taken off, ${tally.alerts}/${ALERTS.length} alerts, test filter turned on for ${tally.filtered} older insights`
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
