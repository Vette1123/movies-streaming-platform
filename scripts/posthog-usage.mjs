#!/usr/bin/env node
/**
 * What people actually use, and what to do about it (masareef's pnpm usage).
 *
 *   pnpm posthog:usage                 last 7 days against the 7 before
 *   pnpm posthog:usage --days 28
 *   pnpm posthog:usage --json
 *
 * Reach per product area (the `area` every event carries — lib/analytics.ts
 * EVENT_AREA), events that never fired, new-visitor activation (first_play),
 * the play and support funnels, failure rate per server, rageclicks per route,
 * and a ranked WHAT TO DO list. Humans only: {humans} drops the pre-block fleet
 * and the test cohort.
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'

import { posthogConfig, runQuery } from './lib/posthog.mjs'
import {
  areaReach,
  areaTables,
  neverFired,
  whatToDo,
} from './lib/usage-report.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const D = Math.max(1, Number(option('--days', 7)))
const json = args.includes('--json')

const tables = areaTables(
  readFileSync(new URL('../lib/analytics.ts', import.meta.url), 'utf8')
)
const cfg = posthogConfig()

const now = `timestamp > now() - INTERVAL ${D} DAY`
const before = `timestamp > now() - INTERVAL ${2 * D} DAY AND timestamp <= now() - INTERVAL ${D} DAY`

// Events from before `route` existed carry only the raw pathname; template
// them in SQL the way lib/analytics-context routeTemplate does.
const ROUTE = `coalesce(properties.route, replaceRegexpAll(properties.$pathname, '/[0-9][^/]*', '/:id'))`

const queries = {
  active: `SELECT uniqIf(person_id, ${now}) AS active, uniqIf(person_id, ${before}) AS active_before
           FROM events WHERE {humans} AND timestamp > now() - INTERVAL ${2 * D} DAY LIMIT 1`,
  events: `SELECT event, if(event = 'feature_used', toString(properties.feature), '') AS feature,
                  uniqIf(person_id, ${now}) AS people, countIf(${now}) AS events,
                  uniqIf(person_id, ${before}) AS people_before
           FROM events WHERE {humans} AND timestamp > now() - INTERVAL ${2 * D} DAY
             AND event NOT LIKE '$%'
           GROUP BY event, feature LIMIT 2000`,
  activation: `SELECT count() AS new_people, countIf(played = 1) AS activated,
                      quantileIf(0.5)(to_play_s, played = 1) AS median_to_play_s
               FROM (SELECT person_id, min(timestamp) AS first_at,
                            maxIf(1, event = 'media_played') AS played,
                            dateDiff('second', min(timestamp), minIf(timestamp, event = 'media_played')) AS to_play_s
                     FROM events WHERE {humans} AND timestamp > now() - INTERVAL 90 DAY
                     GROUP BY person_id HAVING first_at > now() - INTERVAL ${D} DAY)
               LIMIT 1`,
  funnel: `SELECT uniqIf(person_id, event = '$pageview') AS visited,
                  uniqIf(person_id, event = 'media_detail_viewed') AS detail,
                  uniqIf(person_id, event = 'media_played') AS played,
                  uniqIf(person_id, event = 'watchlist_added') AS saved
           FROM events WHERE {humans} AND ${now} LIMIT 1`,
  player: `SELECT coalesce(nullIf(toString(properties.source), ''), toString(properties.stream_source), 'unknown') AS source,
                  countIf(event = 'media_played') AS plays, countIf(event = 'player_failed') AS failures
           FROM events WHERE {humans} AND ${now} AND event IN ('media_played', 'player_failed')
           GROUP BY source ORDER BY plays + failures DESC LIMIT 30`,
  support: `SELECT uniqIf(person_id, event = 'support_nudge_shown') AS nudged,
                   uniqIf(person_id, event = 'support_cta_clicked') AS cta,
                   uniqIf(person_id, event = 'checkout_started') AS checkout,
                   uniqIf(person_id, event = 'signed_in') AS signed_in,
                   uniqIf(person_id, event = 'supporter_activated') AS activated
            FROM events WHERE {humans} AND ${now} LIMIT 1`,
  routes: `SELECT ${ROUTE} AS route, uniq(person_id) AS people
           FROM events WHERE {humans} AND ${now} AND event = '$pageview'
           GROUP BY route ORDER BY people DESC LIMIT 15`,
  rage: `SELECT ${ROUTE} AS route, count() AS c
         FROM events WHERE {humans} AND ${now} AND event IN ('$rageclick', '$dead_click')
         GROUP BY route ORDER BY c DESC LIMIT 10`,
  errors: `SELECT event, coalesce(nullIf(toString(properties.source), ''), toString(properties.$exception_types)) AS kind,
                  count() AS c, uniq(person_id) AS people
           FROM events WHERE {humans} AND ${now} AND event IN ('$exception', 'api_error')
           GROUP BY event, kind ORDER BY people DESC LIMIT 15`,
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-')
const arrow = (now_, before_) => {
  if (!before_) return ''
  const delta = Math.round((100 * (now_ - before_)) / before_)
  return delta >= 0 ? ` (+${delta}%)` : ` (${delta}%)`
}

try {
  const entries = await Promise.all(
    Object.entries(queries).map(async ([key, sql]) => [
      key,
      await runQuery(cfg, sql),
    ])
  )
  const r = Object.fromEntries(entries)
  const { active, active_before } = r.active[0] ?? {}
  const reach = areaReach(r.events, tables, active, active_before)
  const activationRow = r.activation[0] ?? {}
  const activation = {
    new_people: Number(activationRow.new_people) || 0,
    activated: Number(activationRow.activated) || 0,
    median_to_play_s: activationRow.median_to_play_s,
  }
  activation.rate = activation.new_people
    ? activation.activated / activation.new_people
    : 0
  const support = Object.fromEntries(
    Object.entries(r.support[0] ?? {}).map(([k, v]) => [k, Number(v) || 0])
  )
  const todo = whatToDo({
    reach,
    activation,
    player: r.player,
    support,
    rage: r.rage,
  })
  const unseen = neverFired(r.events, tables)

  if (json) {
    console.log(
      JSON.stringify(
        {
          days: D,
          active,
          active_before,
          reach,
          activation,
          ...r,
          unseen,
          todo,
        },
        null,
        2
      )
    )
    process.exit(0)
  }

  console.log(
    `\nReely usage — last ${D} days vs the ${D} before (${cfg.host}, project ${cfg.project})`
  )
  console.log(`active people: ${active}${arrow(active, active_before)}\n`)

  console.log('REACH BY AREA (share of active people)')
  for (const a of reach) {
    console.log(
      `  ${a.area.padEnd(11)} ${String(a.people).padStart(5)}  ${pct(a.people, active).padStart(4)}   before ${pct(a.before, active_before)}`
    )
  }

  const f = r.funnel[0] ?? {}
  console.log('\nCORE FUNNEL (people)')
  console.log(
    `  visited ${f.visited} → detail ${f.detail} (${pct(f.detail, f.visited)}) → played ${f.played} (${pct(f.played, f.visited)}) · saved ${f.saved}`
  )

  console.log('\nACTIVATION (people first seen in the window)')
  const median = activation.median_to_play_s
  const medianText = median
    ? `, median ${Math.round(median)}s to first play`
    : ''
  console.log(
    `  ${activation.activated} of ${activation.new_people} played something (${pct(activation.activated, activation.new_people)})${medianText}`
  )

  console.log('\nPLAYER — plays vs failures by server')
  for (const p of r.player) {
    console.log(
      `  ${String(p.source).padEnd(22)} plays ${String(p.plays).padStart(5)}  failures ${String(p.failures).padStart(5)}  (${pct(p.failures, Number(p.plays) + Number(p.failures))})`
    )
  }

  console.log('\nSUPPORT FUNNEL (people)')
  console.log(
    `  nudged ${support.nudged} · CTA ${support.cta} · checkout ${support.checkout} · signed in ${support.signed_in} · supporter ${support.activated}`
  )

  console.log('\nTOP ROUTES')
  for (const row of r.routes)
    console.log(`  ${String(row.route).padEnd(28)} ${row.people}`)

  console.log('\nERRORS (people)')
  for (const row of r.errors)
    console.log(
      `  ${row.event.padEnd(11)} ${String(row.kind).slice(0, 40).padEnd(40)} ${row.people} people / ${row.c}`
    )

  if (unseen.length) {
    console.log(
      `\nNEVER FIRED in ${D} days (${unseen.length}): ${unseen.join(', ')}`
    )
  }

  console.log('\nWHAT TO DO')
  if (!todo.length) console.log('  nothing tripped a rule')
  todo.forEach((line, i) => console.log(`  ${i + 1}. ${line}`))
} catch (error) {
  console.error(`::error::${error.message}`)
  process.exit(1)
}
