#!/usr/bin/env node
/**
 * The audience numbers a sponsor asks for, from PostHog, last 30 days, humans
 * only (after the bot block, outside the test cohort and the headless fleet).
 *
 *   pnpm sponsor:stats            print them, ready to paste into a reply
 *   pnpm sponsor:stats --write    also refresh data/audience.json (/advertise)
 *
 * "Plays" is `media_played`, the moment the sponsor card mounts, so it is also
 * the card's ceiling on impressions. The card's own counts are
 * `feature_used {feature: 'sponsor'}`, shown and click.
 */
import { writeFileSync } from 'node:fs'
import process from 'node:process'

import { posthogConfig, runQuery } from './lib/posthog.mjs'

const WINDOW = 'timestamp > now() - INTERVAL 30 DAY AND {humans}'

const cfg = posthogConfig()
const [totals] = await runQuery(
  cfg,
  `SELECT uniq(person_id) AS people,
          uniq(properties.$session_id) AS sessions,
          countIf(event = '$pageview') AS pageviews,
          countIf(event = 'media_played') AS plays,
          uniqIf(person_id, event = 'media_played') AS viewers
   FROM events WHERE ${WINDOW}`
)
const countries = await runQuery(
  cfg,
  `SELECT properties.$geoip_country_code AS cc, uniq(person_id) AS people
   FROM events WHERE ${WINDOW} AND cc IS NOT NULL
   GROUP BY cc ORDER BY people DESC LIMIT 5`
)
const [card] = await runQuery(
  cfg,
  `SELECT countIf(properties.action = 'shown') AS shown,
          countIf(properties.action = 'click') AS clicks
   FROM events WHERE ${WINDOW} AND event = 'feature_used'
     AND properties.feature = 'sponsor'`
)

// A zero here is a broken query or a dead pipeline, never a real month.
for (const key of ['people', 'sessions', 'pageviews', 'plays']) {
  if (!(Number(totals[key]) > 0)) {
    console.error(`sponsor:stats: ${key} = ${totals[key]}; refusing to publish`)
    process.exit(1)
  }
}

const audience = {
  asOf: new Date().toISOString().slice(0, 10),
  windowDays: 30,
  people: Number(totals.people),
  sessions: Number(totals.sessions),
  pageviews: Number(totals.pageviews),
  plays: Number(totals.plays),
  viewers: Number(totals.viewers),
  topCountries: countries.map((r) => r.cc),
}

console.log(`Reely, last 30 days (humans only), as of ${audience.asOf}`)
console.log(`  people          ${audience.people}`)
console.log(`  sessions        ${audience.sessions}`)
console.log(`  page views      ${audience.pageviews}`)
console.log(
  `  plays           ${audience.plays} (by ${audience.viewers} people)`
)
console.log(`  top countries   ${audience.topCountries.join(', ')}`)
console.log(`  sponsor card    ${card.shown} shown, ${card.clicks} clicks`)

if (process.argv.includes('--write')) {
  writeFileSync('data/audience.json', `${JSON.stringify(audience, null, 2)}\n`)
  console.log('wrote data/audience.json')
} else {
  console.log('(print only; --write refreshes data/audience.json)')
}
