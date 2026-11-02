// Now against the past: how far each number moved in 1, 3, 7 and 28 days, as a
// count and a %, and the rate per day. Ported from masareef's
// scripts/posthog-comparisons.mjs (same helpers, Reely's events).
//
// PostHog's own "compare to previous period" has no meaning on an all-time
// range, so totals are worked out here from each person's first matching
// event. Windows are rolling (the last 24 hours, not "today"), so a number read
// at 09:00 is not half a day short. "All time" starts at the 2026-09-02 bot
// block (HUMANS).
import { hogql, trends } from './lib/posthog-insights.mjs'
import { HUMANS } from './lib/posthog.mjs'

export const WINDOWS = [1, 3, 7, 28]

const ago = (n) => `now() - INTERVAL ${n} DAY`

/** A signed % string in SQL: `+12.5%`, `-3%`, `from 0` when it started at zero, `-` when both are zero. */
export const pct = (now, prev) =>
  `multiIf(${prev} = 0 AND ${now} = 0, '-', ${prev} = 0, 'from 0', ${now} >= ${prev}, concat('+', toString(round(100.0 * (${now} - ${prev}) / ${prev}, 1)), '%'), concat(toString(round(100.0 * (${now} - ${prev}) / ${prev}, 1)), '%'))`

/**
 * One row per metric from ONE pass over events: a UNION of a dozen scans hits
 * PostHog's time limit. Aggregates become columns, then arrayJoin turns them
 * back into rows. rows: [label, better, ...aggregate SQL]. Pure.
 */
export function unpivot(rows, whereSql) {
  const columns = rows.flatMap(([, , ...aggs], r) =>
    aggs.map((agg, c) => `${agg} AS m${r}_${c}`)
  )
  // toInt: arrayJoin needs one tuple type, and a count is UInt64 but a difference Int64.
  const tuples = rows.map(
    ([label, better, ...aggs], r) =>
      `(${r}, '${label}', '${better}', ${aggs.map((_, c) => `toInt(m${r}_${c})`).join(', ')})`
  )
  return `SELECT arrayJoin([${tuples.join(', ')}]) AS r FROM (SELECT ${columns.join(', ')} FROM events WHERE ${whereSql})`
}

// ---- Totals: all time, and how much of it the last 1/3/7/28 days added ------

const TOTALS = [
  ['People', "event = '$pageview'"],
  ['People who played', "event = 'media_played'"],
  ['People who searched', "event = 'search_performed'"],
  ['People who installed the app', "event = 'pwa_installed'"],
  ['People who signed in', "event = 'signed_in'"],
  ['Supporters', "event = 'supporter_activated'"],
]

const totalsColumns = (firstAt) =>
  [
    `count() AS total`,
    ...WINDOWS.map((n) => `countIf(${firstAt} <= ${ago(n)}) AS d${n}`),
  ].join(', ')

const totalRow = ([label, cond], i) =>
  `SELECT ${i} AS ord, '${label}' AS metric, ${totalsColumns('first_at')}
   FROM (SELECT person_id, min(timestamp) AS first_at FROM events WHERE ${HUMANS} AND ${cond} GROUP BY person_id)`

const TOTAL_ROWS = [
  ...TOTALS.map(totalRow),
  `SELECT ${TOTALS.length} AS ord, 'Plays (all people)' AS metric, ${totalsColumns('timestamp')}
   FROM events WHERE ${HUMANS} AND event = 'media_played'`,
].join('\n UNION ALL\n ')

export const TOTALS_SQL = `SELECT metric, total,
  ${WINDOWS.map((n) => `total - d${n} AS added_${n}d, ${pct('total', `d${n}`)} AS pct_${n}d`).join(',\n  ')},
  round((total - d7) / 7, 1) AS per_day_7d,
  round((total - d28) / 28, 1) AS per_day_28d
FROM (
 ${TOTAL_ROWS}
)
ORDER BY ord
LIMIT 20`

// ---- Activity: the last N days against the N before ------------------------

const cur = (n) => `timestamp > ${ago(n)}`
const prev = (n) => `timestamp <= ${ago(n)} AND timestamp > ${ago(2 * n)}`
const count = (cond) => (win) => `countIf(${cond} AND ${win})`
const people = (cond) => (win) => `uniqIf(person_id, ${cond} AND ${win})`

// better: "up" = more is good news, "down" = less is good news. A label
// starting "People" is a unique count: over 28 days it is not 28 single days,
// so it gets no per-day rate.
export const ACTIVITY = [
  ['People active', 'up', people("event = '$pageview'")],
  ['People who played', 'up', people("event = 'media_played'")],
  ['Plays', 'up', count("event = 'media_played'")],
  ['First plays (new players)', 'up', count("event = 'first_play'")],
  ['Detail pages opened', 'up', count("event = 'media_detail_viewed'")],
  ['Searches', 'up', count("event = 'search_performed'")],
  [
    'Added to history or watchlist',
    'up',
    count("event IN ('watch_history_added', 'watchlist_added')"),
  ],
  ['App installs', 'up', count("event = 'pwa_installed'")],
  ['People signing in', 'up', people("event = 'signed_in'")],
  ['Player trials started', 'up', count("event = 'player_trial_started'")],
  ['Checkouts started', 'up', count("event = 'checkout_started'")],
  ['Supporters activated', 'up', count("event = 'supporter_activated'")],
  ['Player failures', 'down', count("event = 'player_failed'")],
  ['People whose player failed', 'down', people("event = 'player_failed'")],
  ['People hitting exceptions', 'down', people("event = '$exception'")],
  ['Handled API errors', 'down', count("event = 'api_error'")],
  ['Searches with no result', 'down', count("event = 'search_no_results'")],
  ['Rage clicks', 'down', count("event = '$rageclick'")],
]

const ACTIVITY_ROWS = ACTIVITY.map(([label, better, agg]) => [
  label,
  better,
  ...WINDOWS.flatMap((n) => [agg(cur(n)), agg(prev(n))]),
])

// r.1 order, r.2 label, r.3 better, then a now/prev pair per window from r.4.
const activityColumns = WINDOWS.map((n, i) => {
  const now = `r.${4 + 2 * i}`
  const rate =
    n > 1
      ? `, if(r.2 LIKE 'People%', NULL, round(${now} / ${n}, 1)) AS per_day_${n}d`
      : ''
  return `${now} AS last_${n}d, ${pct(now, `r.${5 + 2 * i}`)} AS pct_${n}d${rate}`
})

export const ACTIVITY_SQL = `SELECT r.2 AS metric, r.3 AS better_when,
  ${activityColumns.join(',\n  ')}
FROM (${unpivot(ACTIVITY_ROWS, `${HUMANS} AND ${cur(56)}`)})
ORDER BY r.1
LIMIT 30`

// ---- Scoreboard: this week vs last, worst news first ------------------------

// Tolerance: within 10% of last week is WATCH, not BAD.
export const SCOREBOARD_SQL = `SELECT metric, this_week, last_week, ${pct('this_week', 'last_week')} AS change,
       multiIf(
         this_week = 0 AND last_week = 0, 'quiet',
         better_when = 'up' AND this_week >= last_week * 1.1, 'GOOD',
         better_when = 'up' AND this_week >= last_week * 0.9, 'WATCH',
         better_when = 'up', 'BAD',
         better_when = 'down' AND this_week <= last_week * 0.9, 'GOOD',
         better_when = 'down' AND this_week <= last_week * 1.1, 'WATCH',
         'BAD') AS verdict
FROM (
 SELECT r.2 AS metric, r.3 AS better_when, r.4 AS this_week, r.5 AS last_week
 FROM (${unpivot(
   ACTIVITY.map(([label, better, agg]) => [
     label,
     better,
     agg(cur(7)),
     agg(prev(7)),
   ]),
   `${HUMANS} AND ${cur(14)}`
 )})
)
ORDER BY multiIf(verdict = 'BAD', 0, verdict = 'WATCH', 1, verdict = 'GOOD', 2, 3), metric
LIMIT 50`

// ---- Day by day ---------------------------------------------------------------

const lag = (col, n) =>
  `lagInFrame(${col}, ${n}) OVER (ORDER BY day ROWS BETWEEN ${n} PRECEDING AND CURRENT ROW)`

export const DAILY_SQL = `SELECT day, people,
  ${pct('people', 'people_1')} AS vs_day_before,
  ${pct('people', 'people_7')} AS vs_week_before,
  plays, ${pct('plays', 'plays_7')} AS plays_vs_week_before,
  first_plays,
  failures, ${pct('failures', 'failures_7')} AS failures_vs_week_before
FROM (
  SELECT day, people, plays, first_plays, failures,
    ${lag('people', 1)} AS people_1,
    ${lag('people', 7)} AS people_7,
    ${lag('plays', 7)} AS plays_7,
    ${lag('failures', 7)} AS failures_7
  FROM (
    SELECT toDate(timestamp) AS day,
      uniqIf(person_id, event = '$pageview') AS people,
      countIf(event = 'media_played') AS plays,
      countIf(event = 'first_play') AS first_plays,
      countIf(event = 'player_failed') AS failures
    FROM events WHERE ${HUMANS} AND ${cur(36)}
    GROUP BY day
  )
)
WHERE day >= today() - 28
ORDER BY day DESC
LIMIT 29`

// Each person adds 1 to people on their first day and 1 to players on the day
// of their first play; a running sum turns those into totals.
export const TOTAL_OVER_TIME_SQL = `SELECT day,
  sum(new_people) OVER (ORDER BY day) AS total_people,
  sum(new_players) OVER (ORDER BY day) AS total_players
FROM (
  SELECT t.1 AS day, sum(t.2) AS new_people, sum(t.3) AS new_players
  FROM (
    SELECT arrayJoin(if(played > 0,
             [(toDate(first_at), 1, 0), (toDate(first_play_at), 0, 1)],
             [(toDate(first_at), 1, 0)])) AS t
    FROM (SELECT person_id, min(timestamp) AS first_at,
                 minIf(timestamp, event = 'media_played') AS first_play_at,
                 countIf(event = 'media_played') AS played
          FROM events WHERE ${HUMANS} GROUP BY person_id)
  )
  GROUP BY day
)
ORDER BY day
LIMIT 200`

const perDay = (name, series) => ({
  name,
  size: 'half',
  query: trends({ series, from: '-28d', display: 'ActionsBar', compare: true }),
})

export const SCOREBOARD_TILE = {
  name: 'Scoreboard — this week vs last (BAD first)',
  description:
    'GOOD = better than last week by more than 10%; WATCH = within 10%; BAD = worse by more than 10%.',
  size: 'table',
  query: hogql(SCOREBOARD_SQL),
}

export const COMPARISON_TILES = [
  {
    name: 'Totals — now vs 1, 3, 7 and 28 days ago',
    description:
      'All time since the 2026-09-02 bot block; added_Nd = how many the last N days brought in.',
    size: 'table',
    query: hogql(TOTALS_SQL),
  },
  {
    name: 'Activity — last 1, 3, 7 and 28 days vs the period before',
    description:
      'Rolling windows (last 24h, not "today"). better_when says which direction is good news.',
    size: 'table',
    query: hogql(ACTIVITY_SQL),
  },
  {
    name: 'Day by day — vs the day and week before (today is partial)',
    size: 'table',
    query: hogql(DAILY_SQL),
  },
  {
    name: 'Total people and players over time',
    size: 'full',
    query: hogql(TOTAL_OVER_TIME_SQL, 'ActionsLineGraph', {
      x: 'day',
      y: ['total_people', 'total_players'],
    }),
  },
  perDay('People per day — vs the 28 days before', [
    { event: '$pageview', math: 'dau', name: 'People' },
  ]),
  perDay('Plays per day — vs the 28 days before', ['media_played']),
]
