// Reely's PostHog dashboards, as data. `pnpm posthog:setup` applies it.
//
// The standard three, the same set masareef and rafiq run (see
// ~/.claude/rules/posthog.md):
//   1. Live & Reach      — who is here right now, where from, on what. Pinned
//                          as the project's home dashboard.
//   2. Weekly Action Board — the handful of numbers that decide what to work on
//                          this week: activation, the play funnel, player
//                          health per server, the support funnel, errors.
//   3. Growth & Deep-Dive — retention, lifecycle, reach by area and feature,
//                          plus the older exploratory tiles.
//
// HogQL tiles use HUMANS (after the bot block, outside the test cohort);
// Trends/Funnels use filterTestAccounts. Edit here and re-run — the script
// updates tiles in place by name.
import {
  funnel,
  hogql,
  lifecycle,
  retention,
  trends,
} from './lib/posthog-insights.mjs'
import { HUMANS, NOT_FLEET, TEST_COHORT_ID } from './lib/posthog.mjs'

const ROUTE = `coalesce(properties.route, replaceRegexpAll(properties.$pathname, '/[0-9][^/]*', '/:id'))`

export const PROJECT_SETTINGS = {
  name: 'Reely',
  product_description:
    'Reely (reely.space) — a free web app to discover, track and stream movies and TV shows, built on TMDB. Visitors browse and search titles, open a detail page, press play on an embedded or house player, keep a watchlist and watch history in the browser, and can sign in and become supporters (paid via Buy Me a Coffee). Global audience, mostly mobile. Core conversion: media_played. Activation: first_play. Every custom event carries `area`; pageviews carry a `route` template.',
  // What "filter out internal and test users" means on every Trends/Funnel
  // tile: our own browsers, and the near-square desktop bot fleet.
  test_account_filters: [
    { key: 'id', type: 'cohort', value: TEST_COHORT_ID, operator: 'not_in' },
    { key: NOT_FLEET, type: 'hogql', value: null },
  ],
}

export const DASHBOARDS = [
  {
    key: 'live',
    name: 'Reely — Live & Reach',
    description:
      'Right now: who is on the site, where from, on which screen. Pinned as the home dashboard. Humans only.',
    primary: true,
    tiles: [
      {
        name: 'People on the site — last 5 min',
        query: hogql(
          `SELECT uniq(person_id) AS people FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 5 MINUTE`,
          'BoldNumber'
        ),
      },
      {
        name: 'People — last 30 min',
        query: hogql(
          `SELECT uniq(person_id) AS people FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 MINUTE`,
          'BoldNumber'
        ),
      },
      {
        name: 'Plays today',
        query: hogql(
          `SELECT count() AS plays FROM events WHERE ${HUMANS} AND event = 'media_played' AND timestamp > toStartOfDay(now())`,
          'BoldNumber'
        ),
      },
      {
        name: 'Pageviews and plays per minute — last hour',
        query: hogql(
          `SELECT toStartOfMinute(timestamp) AS minute,
                  countIf(event = '$pageview') AS pageviews,
                  countIf(event = 'media_played') AS plays
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 60 MINUTE
           GROUP BY minute ORDER BY minute`,
          'ActionsLineGraph'
        ),
      },
      {
        name: 'Who is here — last 30 min',
        query: hogql(
          `SELECT dateDiff('minute', max(timestamp), now()) AS minutes_ago,
                  argMax(properties.$geoip_country_code, timestamp) AS country,
                  argMax(${ROUTE}, timestamp) AS route,
                  argMax(event, timestamp) AS last_event,
                  argMax(properties.$device_type, timestamp) AS device,
                  argMax(properties.$browser, timestamp) AS browser,
                  argMax(properties.visit_n, timestamp) AS visit_n,
                  argMax(properties.supporter, timestamp) AS supporter,
                  count() AS events
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 MINUTE
           GROUP BY person_id ORDER BY minutes_ago ASC, events DESC LIMIT 50`
        ),
      },
      {
        name: 'Live feed — last 60 product events',
        query: hogql(
          `SELECT timestamp, event, properties.area AS area, ${ROUTE} AS route,
                  coalesce(properties.title, toString(properties.feature), toString(properties.surface), '') AS detail,
                  properties.$geoip_country_code AS country
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 1 DAY
             AND event NOT LIKE '$%' AND event NOT IN ('image_host_fallback')
           ORDER BY timestamp DESC LIMIT 60`
        ),
      },
      {
        name: 'Today by country',
        query: hogql(
          `SELECT properties.$geoip_country_name AS country, uniq(person_id) AS people,
                  uniqIf(person_id, event = 'media_played') AS played
           FROM events WHERE ${HUMANS} AND timestamp > toStartOfDay(now())
           GROUP BY country ORDER BY people DESC LIMIT 20`
        ),
      },
      {
        name: 'Today by screen',
        query: hogql(
          `SELECT ${ROUTE} AS route, uniq(person_id) AS people, count() AS views
           FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > toStartOfDay(now())
           GROUP BY route ORDER BY people DESC LIMIT 20`
        ),
      },
      {
        name: 'New visitors today by source',
        query: hogql(
          `SELECT coalesce(nullIf(source, '$direct'), 'direct') AS source, count() AS new_people
           FROM (SELECT person_id, min(timestamp) AS first_at,
                        argMin(properties.$referring_domain, timestamp) AS source
                 FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > now() - INTERVAL 90 DAY
                 GROUP BY person_id)
           WHERE first_at > toStartOfDay(now())
           GROUP BY source ORDER BY new_people DESC LIMIT 15`
        ),
      },
      {
        name: 'DAU / WAU / MAU',
        query: trends({
          series: [
            { event: '$pageview', math: 'dau', name: 'Daily' },
            { event: '$pageview', math: 'weekly_active', name: 'Weekly' },
            { event: '$pageview', math: 'monthly_active', name: 'Monthly' },
          ],
          from: '-60d',
        }),
      },
      {
        name: 'Devices — last 7 days',
        query: hogql(
          `SELECT properties.$device_type AS device, properties.$browser AS browser,
                  uniq(person_id) AS people
           FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
           GROUP BY device, browser ORDER BY people DESC LIMIT 15`
        ),
      },
    ],
  },
  {
    key: 'weekly',
    name: 'Reely — Weekly Action Board',
    description:
      'The numbers that decide what to work on this week. Read top to bottom; `pnpm posthog:usage` prints the same with a WHAT TO DO list.',
    tiles: [
      {
        name: 'Active people — this week vs last',
        query: hogql(
          `SELECT uniqIf(person_id, timestamp > now() - INTERVAL 7 DAY) AS this_week,
                  uniqIf(person_id, timestamp <= now() - INTERVAL 7 DAY) AS last_week,
                  round(100 * (this_week - last_week) / greatest(last_week, 1)) AS change_pct
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 14 DAY`
        ),
      },
      {
        name: 'Activation — new visitors who played, by week',
        description: 'Share of people first seen that week who reached a play.',
        query: hogql(
          `SELECT toStartOfWeek(first_at) AS week, count() AS new_people,
                  countIf(played = 1) AS played,
                  round(100 * played / greatest(new_people, 1), 1) AS activation_pct
           FROM (SELECT person_id, min(timestamp) AS first_at, maxIf(1, event = 'media_played') AS played
                 FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 120 DAY GROUP BY person_id)
           WHERE first_at > now() - INTERVAL 84 DAY
           GROUP BY week ORDER BY week`,
          'ActionsLineGraph'
        ),
      },
      {
        name: 'Time to first play (new browsers)',
        description:
          'first_play.since_first_visit_s — median and p75, by week.',
        query: hogql(
          `SELECT toStartOfWeek(timestamp) AS week, count() AS first_plays,
                  round(quantile(0.5)(toFloat(properties.since_first_visit_s))) AS median_s,
                  round(quantile(0.75)(toFloat(properties.since_first_visit_s))) AS p75_s
           FROM events WHERE ${HUMANS} AND event = 'first_play'
           GROUP BY week ORDER BY week DESC LIMIT 12`
        ),
      },
      {
        name: 'Funnel — visit → detail → play',
        query: funnel({
          steps: ['$pageview', 'media_detail_viewed', 'media_played'],
          from: '-7d',
        }),
      },
      {
        name: 'Funnel — search → result → play',
        query: funnel({
          steps: ['search_performed', 'search_result_clicked', 'media_played'],
          from: '-14d',
        }),
      },
      {
        name: 'Player health — plays vs failures by server',
        query: hogql(
          `SELECT coalesce(nullIf(toString(properties.source), ''), toString(properties.stream_source), 'unknown') AS server,
                  countIf(event = 'media_played') AS plays,
                  countIf(event = 'player_failed') AS failures,
                  round(100 * failures / greatest(plays + failures, 1), 1) AS failure_pct
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
             AND event IN ('media_played', 'player_failed')
           GROUP BY server ORDER BY plays + failures DESC LIMIT 20`
        ),
      },
      {
        name: 'Player failures per day',
        query: trends({
          series: ['player_failed'],
          from: '-30d',
          breakdown: 'source',
        }),
      },
      {
        name: 'Funnel — support nudge → CTA → checkout → supporter',
        query: funnel({
          steps: [
            'support_nudge_shown',
            'support_cta_clicked',
            'checkout_started',
            'supporter_activated',
          ],
          from: '-60d',
          windowDays: 14,
        }),
      },
      {
        name: 'Errors — top issues, last 7 days',
        query: hogql(
          `SELECT toString(properties.$exception_types) AS type,
                  substring(toString(properties.$exception_values), 1, 120) AS message,
                  ${ROUTE} AS route, uniq(person_id) AS people, count() AS events
           FROM events WHERE ${HUMANS} AND event = '$exception' AND timestamp > now() - INTERVAL 7 DAY
           GROUP BY type, message, route ORDER BY people DESC LIMIT 20`
        ),
      },
      {
        name: 'Handled failures — api_error by source',
        query: hogql(
          `SELECT toString(properties.source) AS source, properties.status AS status,
                  properties.expected AS expected, uniq(person_id) AS people, count() AS events
           FROM events WHERE ${HUMANS} AND event = 'api_error' AND timestamp > now() - INTERVAL 7 DAY
           GROUP BY source, status, expected ORDER BY people DESC LIMIT 20`
        ),
      },
      {
        name: 'Frustration — rage & dead clicks by screen',
        query: hogql(
          `SELECT ${ROUTE} AS route, countIf(event = '$rageclick') AS rageclicks,
                  countIf(event = '$dead_click') AS dead_clicks, uniq(person_id) AS people
           FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
             AND event IN ('$rageclick', '$dead_click')
           GROUP BY route ORDER BY people DESC LIMIT 15`
        ),
      },
      {
        name: 'Retry pressed — by surface',
        query: trends({
          series: ['retry_clicked'],
          from: '-30d',
          breakdown: 'surface',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Search — no-result rate',
        query: hogql(
          `SELECT toStartOfWeek(timestamp) AS week, countIf(event = 'search_performed') AS searches,
                  countIf(event = 'search_no_results') AS no_results,
                  round(100 * no_results / greatest(searches, 1), 1) AS no_result_pct
           FROM events WHERE ${HUMANS} AND event IN ('search_performed', 'search_no_results')
           GROUP BY week ORDER BY week DESC LIMIT 12`
        ),
      },
    ],
  },
  {
    key: 'growth',
    name: 'Reely — Growth & Deep-Dive',
    renameFrom: 'Reely — Product Analytics',
    description:
      'Retention, lifecycle, reach by product area and feature, and the original exploratory tiles. Test accounts filtered.',
    tiles: [
      {
        name: 'Retention — visitors who come back to play (weekly)',
        query: retention({ start: '$pageview', returning: 'media_played' }),
      },
      {
        name: 'Retention — after a first play (weekly)',
        query: retention({ start: 'first_play', returning: 'media_played' }),
      },
      {
        name: 'Lifecycle — new, returning, resurrecting, dormant',
        query: lifecycle({}),
      },
      {
        name: 'Reach by product area (weekly people)',
        query: trends({
          series: [{ event: null, math: 'dau', name: 'People' }],
          interval: 'week',
          from: '-84d',
          breakdown: 'area',
        }),
      },
      {
        name: 'Feature use by feature (people)',
        query: trends({
          series: [{ event: 'feature_used', math: 'dau', name: 'People' }],
          interval: 'week',
          from: '-84d',
          breakdown: 'feature',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Screens by people — last 30 days',
        query: hogql(
          `SELECT ${ROUTE} AS route, uniq(person_id) AS people, count() AS views
           FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY route ORDER BY people DESC LIMIT 30`
        ),
      },
      {
        name: 'Plays — signed in vs anonymous vs supporter',
        query: hogql(
          `SELECT multiIf(properties.supporter = true, 'supporter', properties.signed_in = true, 'signed in', 'anonymous') AS who,
                  uniq(person_id) AS people, count() AS plays
           FROM events WHERE ${HUMANS} AND event = 'media_played' AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY who ORDER BY plays DESC`
        ),
      },
      {
        name: 'Visits per person (visit_n at last event, 30 days)',
        query: hogql(
          `SELECT multiIf(v = 1, '1', v <= 3, '2-3', v <= 10, '4-10', '11+') AS visits, count() AS people
           FROM (SELECT person_id, max(toInt(properties.visit_n)) AS v FROM events
                 WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 DAY AND properties.visit_n IS NOT NULL
                 GROUP BY person_id)
           GROUP BY visits ORDER BY visits`,
          'ActionsBar'
        ),
      },
      {
        name: 'Settings changed — by pref',
        query: trends({
          series: ['pref_changed'],
          from: '-60d',
          breakdown: 'key',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: 'Shares — by surface and method',
        query: hogql(
          `SELECT event, coalesce(toString(properties.surface), toString(properties.method)) AS surface,
                  toString(properties.method) AS method, uniq(person_id) AS people, count() AS shares
           FROM events WHERE ${HUMANS} AND event IN ('shared', 'media_shared', 'invite_shared')
             AND timestamp > now() - INTERVAL 30 DAY
           GROUP BY event, surface, method ORDER BY shares DESC LIMIT 20`
        ),
      },
    ],
  },
]

/**
 * Daily alerts. Each sits on its own small Trends insight on the Weekly board.
 * Plays use a LOWER bound: a build that fails to boot sends no events, so
 * silence is the only symptom (rafiq's tripwire).
 */
export const ALERTS = [
  {
    name: 'Silence — fewer than 15 plays a day',
    tile: {
      name: 'Alert — plays per day',
      query: trends({
        series: ['media_played'],
        from: '-14d',
        display: 'ActionsLineGraph',
      }),
    },
    lower: 15,
  },
  {
    name: 'Spike — more than 40 player failures a day',
    tile: {
      name: 'Alert — player failures per day',
      query: trends({ series: ['player_failed'], from: '-14d' }),
    },
    upper: 40,
  },
  {
    name: 'Spike — exceptions for more than 15 people a day',
    tile: {
      name: 'Alert — people hitting exceptions per day',
      query: trends({
        series: [{ event: '$exception', math: 'dau', name: 'People' }],
        from: '-14d',
      }),
    },
    upper: 15,
  },
  {
    // The chain hides a dead image host from everyone but the first screen, so
    // this is how we hear about it before a user does.
    name: 'Spike — image host down for more than 15 people a day',
    tile: {
      name: 'Alert — people falling off the image host per day',
      query: trends({
        series: [{ event: 'image_host_fallback', math: 'dau', name: 'People' }],
        from: '-14d',
      }),
    },
    upper: 15,
  },
]
