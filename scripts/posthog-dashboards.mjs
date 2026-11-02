// Reely's PostHog dashboards, as data. `pnpm posthog:setup` applies it.
//
// The standard three, the same set masareef and rafiq run (see
// ~/.claude/rules/posthog.md):
//   1. Live & Reach      — who is here right now, where from, on what. Pinned
//                          as the project's home dashboard.
//   2. Weekly Action Board — the handful of numbers that decide what to work on
//                          this week: activation, the play funnel, player
//                          health per server, errors, money, the alerts.
//   3. Growth & Deep-Dive — growth, retention, acquisition, what people watch,
//                          product use and real-user speed.
//
// Each board is a list of `section(...)` headers and tiles, laid out in that
// order on a 12-column grid (`size`: kpi | third | half | wide | full | tall |
// table, see SIZES). The spec OWNS each board: a tile it does not name is taken
// off on the next run, so a hand-made tile belongs here or on another board.
//
// HogQL tiles use HUMANS (after the bot block, outside the test cohort, not the
// fleet). Trends/Funnels/Retention/Lifecycle use filterTestAccounts, which is
// the same three filters (PROJECT_SETTINGS.test_account_filters). Edit here,
// `pnpm posthog:setup --check`, then `pnpm posthog:setup`.
import {
  funnel,
  hogql,
  lifecycle,
  retention,
  section,
  trends,
} from './lib/posthog-insights.mjs'
import {
  AFTER_BOT_BLOCK,
  HUMANS,
  NOT_FLEET,
  TEST_COHORT_ID,
} from './lib/posthog.mjs'
import { COMPARISON_TILES, SCOREBOARD_TILE } from './posthog-comparisons.mjs'

const ROUTE = `coalesce(properties.route, replaceRegexpAll(properties.$pathname, '/[0-9][^/]*', '/:id'))`
const SOURCE = `coalesce(nullIf(replaceRegexpAll(toString(properties.$referring_domain), '^www[.]', ''), '$direct'), 'direct')`
const SERVER = `coalesce(nullIf(toString(properties.source), ''), toString(properties.stream_source), 'unknown')`
const GENRES = `JSONExtract(ifNull(toString(properties.genres), '[]'), 'Array(String)')`

/** One row per person: first seen, first source/screen, whether they played. */
const firstVisits = (days) =>
  `SELECT person_id, min(timestamp) AS first_at,
          argMin(${SOURCE}, timestamp) AS source,
          argMin(${ROUTE}, timestamp) AS first_route,
          argMin(properties.$geoip_country_name, timestamp) AS country,
          maxIf(1, event = 'media_played') AS played
   FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL ${days} DAY
   GROUP BY person_id`

/** One row per person: first day seen, every day seen, every day they played. */
const PERSON_DAYS = `SELECT person_id, toStartOfDay(min(timestamp)) AS first_day,
          groupUniqArray(toStartOfDay(timestamp)) AS days,
          groupUniqArrayIf(toStartOfDay(timestamp), event = 'media_played') AS play_days
   FROM events WHERE ${HUMANS} GROUP BY person_id`

export const PROJECT_SETTINGS = {
  name: 'Reely',
  product_description:
    'Reely (reely.space) — a free web app to discover, track and stream movies and TV shows, built on TMDB. Visitors browse and search titles, open a detail page, press play on an embedded or house player, keep a watchlist and watch history in the browser, and can sign in and become supporters (paid via Buy Me a Coffee). Global audience, mostly mobile. Core conversion: media_played. Activation: first_play. Every custom event carries `area`; pageviews carry a `route` template.',
  // What "filter out internal and test users" means on every Trends/Funnel
  // tile: our own browsers, the near-square desktop bot fleet, and anything
  // before the bot block (a 90-day window otherwise draws the August fleet).
  test_account_filters: [
    { key: 'id', type: 'cohort', value: TEST_COHORT_ID, operator: 'not_in' },
    { key: NOT_FLEET, type: 'hogql', value: null },
    { key: AFTER_BOT_BLOCK, type: 'hogql', value: null },
  ],
}

/**
 * Daily alerts. Each sits on its own small Trends tile in the Alerts section of
 * the Weekly board. Plays use a LOWER bound: a build that fails to boot sends
 * no events, so silence is the only symptom (rafiq's tripwire).
 *
 * The plan allows 5 alerts and a sixth is refused with a 400, so a new one must
 * replace one.
 */
export const ALERTS = [
  {
    name: 'Silence — fewer than 15 plays a day',
    tile: {
      name: 'Alert — plays per day',
      description: 'Alert fires below 15. Silence means the build is down.',
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
      description: 'Alert fires above 40.',
      query: trends({ series: ['player_failed'], from: '-14d' }),
    },
    upper: 40,
  },
  {
    // Zero is the only healthy number: a viewer stuck after every reconnect
    // failed, a refused hop (the player broke its rule), or a hop past the
    // guard (the lock in lib/player-hop.ts was removed). `reason` and `moved`
    // on the event say which.
    name: 'Tripwire — a viewer lost a playing stream',
    tile: {
      name: 'Alert — viewers who lost a playing stream per day',
      description:
        'Must stay at 0. Anything above means a playing stream was taken from a viewer.',
      query: trends({
        series: [
          {
            event: 'player_failed',
            name: 'Lost a playing stream',
            properties: [
              {
                key: 'played',
                value: [true],
                operator: 'exact',
                type: 'event',
              },
              {
                key: 'viewer_chose',
                value: [false],
                operator: 'exact',
                type: 'event',
              },
            ],
          },
        ],
        from: '-14d',
      }),
    },
    upper: 0,
  },
  {
    name: 'Spike — exceptions for more than 15 people a day',
    tile: {
      name: 'Alert — people hitting exceptions per day',
      description: 'Alert fires above 15 people.',
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
      description: 'Alert fires above 15 people.',
      query: trends({
        series: [{ event: 'image_host_fallback', math: 'dau', name: 'People' }],
        from: '-14d',
      }),
    },
    upper: 15,
  },
]

const live = {
  key: 'live',
  name: 'Reely — Live & Reach',
  description:
    'Right now: who is on the site, where from, on which screen, playing what. Pinned as the home dashboard. Real people only — our browsers, the test cohort and the bot fleet are filtered out.',
  primary: true,
  tiles: [
    section('Right now', 'Refresh the dashboard for the latest minute.'),
    {
      name: 'People on the site — last 5 min',
      size: 'kpi',
      query: hogql(
        `SELECT uniq(person_id) AS people FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 5 MINUTE`,
        'BoldNumber'
      ),
    },
    {
      name: 'People — last 30 min',
      size: 'kpi',
      query: hogql(
        `SELECT uniq(person_id) AS people FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 MINUTE`,
        'BoldNumber'
      ),
    },
    {
      name: 'Plays — last 24 hours',
      description: 'Against the 24 hours before.',
      size: 'kpi',
      query: trends({
        series: ['media_played'],
        from: '-24h',
        interval: 'hour',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'New people today',
      description: 'People seen for the first time since midnight UTC.',
      size: 'kpi',
      query: hogql(
        `SELECT countIf(first_at > toStartOfDay(now())) AS new_people FROM (${firstVisits(90)})`,
        'BoldNumber'
      ),
    },
    section(
      'Now vs 1, 3, 7 and 28 days ago',
      'Rolling windows, each against the window before it.'
    ),
    COMPARISON_TILES[0],
    COMPARISON_TILES[1],
    section('Last hour'),
    {
      name: 'Pageviews and plays per minute — last hour',
      size: 'full',
      query: hogql(
        `SELECT toStartOfMinute(timestamp) AS minute,
                countIf(event = '$pageview') AS pageviews,
                countIf(event = 'media_played') AS plays,
                uniq(person_id) AS people
         FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 60 MINUTE
         GROUP BY minute ORDER BY minute`,
        'ActionsLineGraph',
        { x: 'minute', y: ['pageviews', 'plays', 'people'] }
      ),
    },
    {
      name: 'Who is here — last 30 min',
      description:
        'One row per person, most recent first: where they are, what they last did.',
      size: 'table',
      query: hogql(
        `SELECT dateDiff('minute', max(timestamp), now()) AS minutes_ago,
                argMax(properties.$geoip_country_code, timestamp) AS country,
                argMax(${ROUTE}, timestamp) AS route,
                argMax(event, timestamp) AS last_event,
                argMax(properties.title, timestamp) AS last_title,
                argMax(properties.$device_type, timestamp) AS device,
                argMax(properties.$browser, timestamp) AS browser,
                argMax(properties.visit_n, timestamp) AS visit_n,
                argMax(properties.signed_in, timestamp) AS signed_in,
                argMax(properties.supporter, timestamp) AS supporter,
                countIf(event = 'media_played') AS plays,
                count() AS events
         FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 MINUTE
         GROUP BY person_id ORDER BY minutes_ago ASC, events DESC LIMIT 50`
      ),
    },
    section('Today', 'Since midnight UTC.'),
    {
      name: 'Today by country',
      size: 'half',
      query: hogql(
        `SELECT properties.$geoip_country_name AS country, uniq(person_id) AS people,
                uniqIf(person_id, event = 'media_played') AS played,
                round(100 * played / greatest(people, 1)) AS play_pct
         FROM events WHERE ${HUMANS} AND timestamp > toStartOfDay(now())
         GROUP BY country ORDER BY people DESC LIMIT 20`
      ),
    },
    {
      name: 'Today by screen',
      size: 'half',
      query: hogql(
        `SELECT ${ROUTE} AS route, uniq(person_id) AS people, count() AS views
         FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > toStartOfDay(now())
         GROUP BY route ORDER BY people DESC LIMIT 20`
      ),
    },
    {
      name: 'Playing today — top titles',
      size: 'half',
      query: hogql(
        `SELECT properties.title AS title, properties.media_type AS type,
                uniq(person_id) AS people, count() AS plays
         FROM events WHERE ${HUMANS} AND event = 'media_played' AND timestamp > toStartOfDay(now())
         GROUP BY title, type ORDER BY people DESC, plays DESC LIMIT 20`
      ),
    },
    {
      name: 'New visitors today by source',
      description:
        'Referring site of the first pageview of everyone new today, and how many of them played.',
      size: 'half',
      query: hogql(
        `SELECT source, count() AS new_people, countIf(played = 1) AS played
         FROM (${firstVisits(90)})
         WHERE first_at > toStartOfDay(now())
         GROUP BY source ORDER BY new_people DESC LIMIT 15`
      ),
    },
    {
      name: 'Live feed — last 60 product events',
      size: 'table',
      query: hogql(
        `SELECT timestamp, event, properties.area AS area, ${ROUTE} AS route,
                coalesce(properties.title, toString(properties.feature), toString(properties.surface), '') AS detail,
                properties.$geoip_country_code AS country, properties.$device_type AS device
         FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 1 DAY
           AND event NOT LIKE '$%' AND event NOT IN ('image_host_fallback', 'pwa_installable')
         ORDER BY timestamp DESC LIMIT 60`
      ),
    },
    section('Reach — last 30 days'),
    {
      name: 'People, players and new people per day',
      description:
        'people = anyone with an event; players = pressed play; new = first seen that day.',
      size: 'full',
      query: hogql(
        `SELECT day, count() AS people, countIf(has(play_days, day)) AS players,
                countIf(day = first_day) AS new_people
         FROM (${PERSON_DAYS}) ARRAY JOIN days AS day
         WHERE day > now() - INTERVAL 30 DAY
         GROUP BY day ORDER BY day`,
        'ActionsLineGraph',
        { x: 'day', y: ['people', 'players', 'new_people'] }
      ),
    },
    {
      name: 'Where people are — 30 days',
      size: 'tall',
      query: trends({
        series: [{ event: '$pageview', math: 'dau', name: 'People' }],
        from: '-30d',
        display: 'WorldMap',
        breakdown: '$geoip_country_code',
      }),
    },
    {
      name: 'Countries — people, players, play rate (30 days)',
      size: 'tall',
      query: hogql(
        `SELECT properties.$geoip_country_name AS country, uniq(person_id) AS people,
                uniqIf(person_id, event = 'media_played') AS players,
                round(100 * players / greatest(people, 1)) AS play_pct,
                countIf(event = 'media_played') AS plays
         FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 DAY
         GROUP BY country ORDER BY people DESC LIMIT 30`
      ),
    },
    {
      name: 'Devices — last 7 days',
      size: 'third',
      query: trends({
        series: [{ event: '$pageview', math: 'dau', name: 'People' }],
        from: '-7d',
        display: 'ActionsPie',
        breakdown: '$device_type',
      }),
    },
    {
      name: 'Browsers — last 7 days',
      size: 'third',
      query: trends({
        series: [{ event: '$pageview', math: 'dau', name: 'People' }],
        from: '-7d',
        display: 'ActionsPie',
        breakdown: '$browser',
      }),
    },
    {
      name: 'Installed app vs browser tab — last 7 days',
      description: 'display_mode: standalone = opened from the installed PWA.',
      size: 'third',
      query: trends({
        series: [{ event: '$pageview', math: 'dau', name: 'People' }],
        from: '-7d',
        display: 'ActionsPie',
        breakdown: 'display_mode',
      }),
    },
  ],
}

const weekly = {
  key: 'weekly',
  name: 'Reely — Weekly Action Board',
  description:
    'The numbers that decide what to work on this week, top to bottom: the week at a glance, activation, the player, errors, money, alerts. `pnpm posthog:usage` prints the same with a WHAT TO DO list.',
  tiles: [
    section(
      'This week at a glance',
      'Last 7 days, with the change against the 7 before.'
    ),
    {
      name: 'People this week',
      size: 'kpi',
      query: trends({
        series: [{ event: null, math: 'dau', name: 'People' }],
        from: '-7d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'Players this week',
      description: 'People who pressed play at least once.',
      size: 'kpi',
      query: trends({
        series: [{ event: 'media_played', math: 'dau', name: 'Players' }],
        from: '-7d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'Plays this week',
      size: 'kpi',
      query: trends({
        series: ['media_played'],
        from: '-7d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'First plays this week',
      description: 'Browsers that played for the first time ever.',
      size: 'kpi',
      query: trends({
        series: ['first_play'],
        from: '-7d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'Plays per player',
      size: 'kpi',
      query: trends({
        series: [
          { event: 'media_played', name: 'Plays' },
          { event: 'media_played', math: 'dau', name: 'Players' },
        ],
        formula: 'A / B',
        from: '-7d',
        display: 'BoldNumber',
        compare: true,
        decimals: 1,
      }),
    },
    {
      name: 'Player failure rate',
      description: 'player_failed / (plays + player_failed). Lower is better.',
      size: 'kpi',
      query: trends({
        series: ['media_played', 'player_failed'],
        formula: '100 * B / (A + B)',
        from: '-7d',
        display: 'BoldNumber',
        compare: true,
        postfix: '%',
        decimals: 1,
      }),
    },
    {
      name: 'Searches this week',
      size: 'kpi',
      query: trends({
        series: ['search_performed'],
        from: '-7d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'App installs this week',
      size: 'kpi',
      query: trends({
        series: ['pwa_installed'],
        from: '-7d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    SCOREBOARD_TILE,
    section(
      'Activation',
      'Do new visitors reach a play, and how fast? Activation % is the number to move.'
    ),
    {
      name: 'Activation — new visitors who played, by week',
      description: 'Share of people first seen that week who reached a play.',
      size: 'half',
      query: hogql(
        `SELECT toStartOfWeek(first_at) AS week, count() AS new_people,
                countIf(played = 1) AS played,
                round(100 * played / greatest(new_people, 1), 1) AS activation_pct
         FROM (${firstVisits(120)})
         WHERE first_at > now() - INTERVAL 84 DAY
         GROUP BY week ORDER BY week`,
        'ActionsLineGraph',
        { x: 'week', y: ['activation_pct'] }
      ),
    },
    {
      name: 'Time to first play (new browsers)',
      description: 'first_play.since_first_visit_s — median and p75, by week.',
      size: 'half',
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
      size: 'half',
      query: funnel({
        steps: ['$pageview', 'media_detail_viewed', 'media_played'],
        from: '-7d',
      }),
    },
    {
      name: 'Funnel — search → result → play',
      size: 'half',
      query: funnel({
        steps: ['search_performed', 'search_result_clicked', 'media_played'],
        from: '-14d',
      }),
    },
    section(
      'Player health',
      'Does pressing play work? Per server, per day, and what each failure was.'
    ),
    {
      name: 'Player health — plays vs failures by server',
      size: 'half',
      query: hogql(
        `SELECT ${SERVER} AS server,
                countIf(event = 'media_played') AS plays,
                countIf(event = 'player_failed') AS failures,
                round(100 * failures / greatest(plays + failures, 1), 1) AS failure_pct,
                uniqIf(person_id, event = 'player_failed') AS people_failed
         FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
           AND event IN ('media_played', 'player_failed')
         GROUP BY server ORDER BY plays + failures DESC LIMIT 20`
      ),
    },
    {
      name: 'Player failure % per day',
      size: 'half',
      query: hogql(
        `SELECT toStartOfDay(timestamp) AS day,
                round(100 * countIf(event = 'player_failed') / greatest(count(), 1), 1) AS failure_pct
         FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 DAY
           AND event IN ('media_played', 'player_failed')
         GROUP BY day ORDER BY day`,
        'ActionsLineGraph',
        { x: 'day', y: ['failure_pct'] }
      ),
    },
    {
      name: 'Player failures per day — by reason',
      description: 'stall = 9s with no picture, unavailable, stuck.',
      size: 'half',
      query: trends({
        series: ['player_failed'],
        from: '-30d',
        breakdown: 'reason',
        display: 'ActionsBar',
      }),
    },
    {
      name: 'Player incidents — what failed and how it ended',
      size: 'half',
      query: hogql(
        `SELECT toString(properties.step) AS step,
                toString(properties.hls_details) AS details,
                toString(properties.http_status) AS status,
                countIf(properties.played = true) AS mid_play,
                count() AS incidents,
                uniq(person_id) AS people
         FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
           AND event = 'player_incident'
         GROUP BY step, details, status ORDER BY incidents DESC LIMIT 30`
      ),
    },
    section('Errors and friction', 'What broke, and where people got stuck.'),
    {
      name: 'Errors — top issues, last 7 days',
      size: 'table',
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
      size: 'half',
      query: hogql(
        `SELECT toString(properties.source) AS source, properties.status AS status,
                properties.expected AS expected, uniq(person_id) AS people, count() AS events
         FROM events WHERE ${HUMANS} AND event = 'api_error' AND timestamp > now() - INTERVAL 7 DAY
         GROUP BY source, status, expected ORDER BY people DESC LIMIT 20`
      ),
    },
    {
      name: 'Frustration — rage & dead clicks by screen',
      size: 'half',
      query: hogql(
        `SELECT ${ROUTE} AS route, countIf(event = '$rageclick') AS rageclicks,
                countIf(event = '$dead_click') AS dead_clicks,
                countIf(event = '$dead_swipe') AS dead_swipes, uniq(person_id) AS people
         FROM events WHERE ${HUMANS} AND timestamp > now() - INTERVAL 7 DAY
           AND event IN ('$rageclick', '$dead_click', '$dead_swipe')
         GROUP BY route ORDER BY people DESC LIMIT 15`
      ),
    },
    {
      name: 'Search — no-result rate',
      size: 'third',
      query: hogql(
        `SELECT toStartOfWeek(timestamp) AS week, countIf(event = 'search_performed') AS searches,
                countIf(event = 'search_no_results') AS no_results,
                round(100 * no_results / greatest(searches, 1), 1) AS no_result_pct
         FROM events WHERE ${HUMANS} AND event IN ('search_performed', 'search_no_results')
         GROUP BY week ORDER BY week DESC LIMIT 12`
      ),
    },
    {
      name: 'Not found — which addresses (30 days)',
      size: 'third',
      query: hogql(
        `SELECT properties.$pathname AS path, uniq(person_id) AS people, count() AS views
         FROM events WHERE ${HUMANS} AND event = 'page_not_found' AND timestamp > now() - INTERVAL 30 DAY
         GROUP BY path ORDER BY views DESC LIMIT 20`
      ),
    },
    {
      name: 'Retry pressed — by surface',
      size: 'third',
      query: trends({
        series: ['retry_clicked'],
        from: '-30d',
        breakdown: 'surface',
        display: 'ActionsBarValue',
      }),
    },
    section(
      'Money',
      'From the support nudge to a paying supporter, and the Reely Player paywall.'
    ),
    {
      name: 'Funnel — support nudge → CTA → checkout → supporter',
      size: 'wide',
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
      name: 'Paywall — gate, trials, checkouts per week',
      size: 'third',
      query: trends({
        series: [
          'supporter_gate_shown',
          'player_trial_started',
          'checkout_started',
          'supporter_activated',
        ],
        interval: 'week',
        from: '-60d',
        display: 'ActionsBar',
      }),
    },
    section(
      'Alerts',
      'Each tile carries a daily PostHog alert; the threshold is in its description.'
    ),
    ...ALERTS.map((alert) => ({ ...alert.tile, size: 'third' })),
  ],
}

const growth = {
  key: 'growth',
  name: 'Reely — Growth & Deep-Dive',
  renameFrom: 'Reely — Product Analytics',
  description:
    'Growth, retention, where new people come from, what they watch, what they use, and how fast it is for them. Real people only, after the 2026-09-02 bot block.',
  tiles: [
    section(
      'Growth — last 30 days',
      'Against the 30 days before. Data starts at the 2026-09-02 bot block.'
    ),
    {
      name: 'People — 30 days',
      size: 'kpi',
      query: trends({
        series: [{ event: null, math: 'dau', name: 'People' }],
        from: '-30d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'Players — 30 days',
      size: 'kpi',
      query: trends({
        series: [{ event: 'media_played', math: 'dau', name: 'Players' }],
        from: '-30d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'Plays — 30 days',
      size: 'kpi',
      query: trends({
        series: ['media_played'],
        from: '-30d',
        display: 'BoldNumber',
        compare: true,
      }),
    },
    {
      name: 'Activation — new people who played (30 days)',
      size: 'kpi',
      query: hogql(
        `SELECT concat(toString(round(100 * countIf(played = 1) / greatest(count(), 1), 1)), '%') AS activation
         FROM (${firstVisits(60)}) WHERE first_at > now() - INTERVAL 30 DAY`,
        'BoldNumber'
      ),
    },
    section(
      'Now vs 1, 3, 7 and 28 days ago',
      'Totals and activity against the past, day by day, and running totals.'
    ),
    ...COMPARISON_TILES,
    section('Who comes, and who comes back'),
    {
      name: 'New and returning people per day',
      description:
        'new = first seen that day; returning = seen on an earlier day.',
      size: 'full',
      query: hogql(
        `SELECT day, countIf(day = first_day) AS new_people,
                countIf(day != first_day) AS returning_people
         FROM (${PERSON_DAYS}) ARRAY JOIN days AS day
         WHERE day > now() - INTERVAL 30 DAY
         GROUP BY day ORDER BY day`,
        'ActionsStackedBar',
        { x: 'day', y: ['new_people', 'returning_people'] }
      ),
    },
    {
      name: 'DAU / WAU / MAU',
      size: 'half',
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
      name: 'Lifecycle — new, returning, resurrecting, dormant',
      size: 'half',
      query: lifecycle({ from: '-56d' }),
    },
    {
      name: 'Days active per person — 30 days',
      description:
        'How many separate days each person came. 1 = one-off visit.',
      size: 'half',
      query: hogql(
        `SELECT multiIf(d = 1, '1 day', d = 2, '2 days', d <= 4, '3-4 days', d <= 9, '5-9 days', '10+ days') AS days_active,
                count() AS people
         FROM (SELECT person_id, uniq(toDate(timestamp)) AS d FROM events
               WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 DAY GROUP BY person_id)
         GROUP BY days_active ORDER BY min(d)`,
        'ActionsBar',
        { x: 'days_active', y: ['people'] }
      ),
    },
    {
      name: 'Visits per person (visit_n at last event, 30 days)',
      size: 'half',
      query: hogql(
        `SELECT multiIf(v = 1, '1', v <= 3, '2-3', v <= 10, '4-10', '11+') AS visits, count() AS people
         FROM (SELECT person_id, max(toInt(properties.visit_n)) AS v FROM events
               WHERE ${HUMANS} AND timestamp > now() - INTERVAL 30 DAY AND properties.visit_n IS NOT NULL
               GROUP BY person_id)
         GROUP BY visits ORDER BY min(v)`,
        'ActionsBar',
        { x: 'visits', y: ['people'] }
      ),
    },
    section(
      'Retention',
      'Of the people who started in a week, how many came back to play.'
    ),
    {
      name: 'Retention — visitors who come back to play (weekly)',
      size: 'tall',
      query: retention({ start: '$pageview', returning: 'media_played' }),
    },
    {
      name: 'Retention — after a first play (weekly)',
      size: 'tall',
      query: retention({ start: 'first_play', returning: 'media_played' }),
    },
    section(
      'Acquisition — last 30 days',
      'Where new people came from, where they landed, and whether they played.'
    ),
    {
      name: 'New people by source — and how many played',
      size: 'half',
      query: hogql(
        `SELECT source, count() AS new_people, countIf(played = 1) AS played,
                round(100 * played / greatest(new_people, 1)) AS activation_pct
         FROM (${firstVisits(60)}) WHERE first_at > now() - INTERVAL 30 DAY
         GROUP BY source ORDER BY new_people DESC LIMIT 25`
      ),
    },
    {
      name: 'Landing screen of new people — and how many played',
      size: 'half',
      query: hogql(
        `SELECT first_route AS landing, count() AS new_people, countIf(played = 1) AS played,
                round(100 * played / greatest(new_people, 1)) AS activation_pct
         FROM (${firstVisits(60)}) WHERE first_at > now() - INTERVAL 30 DAY
         GROUP BY landing ORDER BY new_people DESC LIMIT 25`
      ),
    },
    {
      name: 'New people per week — by source',
      size: 'full',
      query: hogql(
        `SELECT toStartOfWeek(first_at) AS week,
                countIf(source = 'direct') AS direct,
                countIf(source LIKE '%google%') AS google,
                countIf(source LIKE '%bing%' OR source LIKE '%duckduckgo%' OR source LIKE '%yandex%' OR source LIKE '%yahoo%') AS other_search,
                countIf(source NOT IN ('direct') AND source NOT LIKE '%google%' AND source NOT LIKE '%bing%' AND source NOT LIKE '%duckduckgo%' AND source NOT LIKE '%yandex%' AND source NOT LIKE '%yahoo%') AS other_sites
         FROM (${firstVisits(120)}) WHERE first_at > now() - INTERVAL 84 DAY
         GROUP BY week ORDER BY week`,
        'ActionsStackedBar',
        { x: 'week', y: ['direct', 'google', 'other_search', 'other_sites'] }
      ),
    },
    section('What people watch — last 30 days'),
    {
      name: 'Top titles played',
      size: 'tall',
      query: hogql(
        `SELECT properties.title AS title, properties.media_type AS type,
                uniq(person_id) AS people, count() AS plays
         FROM events WHERE ${HUMANS} AND event = 'media_played' AND timestamp > now() - INTERVAL 30 DAY
         GROUP BY title, type ORDER BY people DESC, plays DESC LIMIT 30`
      ),
    },
    {
      name: 'Plays by genre',
      size: 'tall',
      query: hogql(
        `SELECT genre, uniq(person_id) AS people, count() AS plays
         FROM (SELECT arrayJoin(${GENRES}) AS genre, person_id FROM events
               WHERE ${HUMANS} AND event = 'media_played' AND timestamp > now() - INTERVAL 30 DAY)
         GROUP BY genre ORDER BY plays DESC LIMIT 20`,
        'ActionsBar',
        { x: 'genre', y: ['plays'] }
      ),
    },
    {
      name: 'Movies vs TV — plays per week',
      size: 'third',
      query: trends({
        series: ['media_played'],
        interval: 'week',
        from: '-56d',
        breakdown: 'media_type',
        display: 'ActionsBar',
      }),
    },
    {
      name: 'Plays by server',
      size: 'third',
      query: trends({
        series: ['media_played'],
        from: '-30d',
        breakdown: 'stream_source',
        display: 'ActionsPie',
      }),
    },
    {
      name: 'Plays — signed in vs anonymous vs supporter',
      size: 'third',
      query: hogql(
        `SELECT multiIf(properties.supporter = true, 'supporter', properties.signed_in = true, 'signed in', 'anonymous') AS who,
                uniq(person_id) AS people, count() AS plays
         FROM events WHERE ${HUMANS} AND event = 'media_played' AND timestamp > now() - INTERVAL 30 DAY
         GROUP BY who ORDER BY plays DESC`
      ),
    },
    section('Product use', 'Which parts of Reely people actually use.'),
    {
      name: 'Reach by product area (weekly people)',
      size: 'half',
      query: trends({
        series: [{ event: null, math: 'dau', name: 'People' }],
        interval: 'week',
        from: '-56d',
        breakdown: 'area',
      }),
    },
    {
      name: 'Feature use by feature (people)',
      size: 'half',
      query: trends({
        series: [{ event: 'feature_used', math: 'dau', name: 'People' }],
        interval: 'week',
        from: '-56d',
        breakdown: 'feature',
        display: 'ActionsBarValue',
      }),
    },
    {
      name: 'Screens by people — last 30 days',
      size: 'half',
      query: hogql(
        `SELECT ${ROUTE} AS route, uniq(person_id) AS people, count() AS views,
                round(count() / greatest(uniq(person_id), 1), 1) AS views_per_person
         FROM events WHERE ${HUMANS} AND event = '$pageview' AND timestamp > now() - INTERVAL 30 DAY
         GROUP BY route ORDER BY people DESC LIMIT 30`
      ),
    },
    {
      name: 'Library — history, watchlist, ratings per week',
      size: 'half',
      query: trends({
        series: [
          'watch_history_added',
          'watchlist_added',
          'rating_saved',
          'episode_toggled',
        ],
        interval: 'week',
        from: '-56d',
        display: 'ActionsBar',
      }),
    },
    {
      name: 'Settings changed — by pref',
      size: 'half',
      query: trends({
        series: ['pref_changed'],
        from: '-60d',
        breakdown: 'key',
        display: 'ActionsBarValue',
      }),
    },
    {
      name: 'Shares — by surface and method',
      size: 'half',
      query: hogql(
        `SELECT event, coalesce(toString(properties.surface), toString(properties.method)) AS surface,
                toString(properties.method) AS method, uniq(person_id) AS people, count() AS shares
         FROM events WHERE ${HUMANS} AND event IN ('shared', 'media_shared', 'invite_shared')
           AND timestamp > now() - INTERVAL 30 DAY
         GROUP BY event, surface, method ORDER BY shares DESC LIMIT 20`
      ),
    },
    section(
      'Speed — real visitors',
      'p75 web vitals from real browsers (the number Google ranks on). Good: LCP < 2500 ms, INP < 200 ms, CLS < 0.1.'
    ),
    {
      name: 'Web vitals p75 per week',
      size: 'half',
      query: hogql(
        `SELECT toStartOfWeek(timestamp) AS week,
                round(quantile(0.75)(toFloat(properties.$web_vitals_LCP_value))) AS lcp_ms,
                round(quantile(0.75)(toFloat(properties.$web_vitals_FCP_value))) AS fcp_ms,
                round(quantile(0.75)(toFloat(properties.$web_vitals_INP_value))) AS inp_ms
         FROM events WHERE ${HUMANS} AND event = '$web_vitals' AND timestamp > now() - INTERVAL 56 DAY
         GROUP BY week ORDER BY week`,
        'ActionsLineGraph',
        { x: 'week', y: ['lcp_ms', 'fcp_ms', 'inp_ms'] }
      ),
    },
    {
      name: 'Web vitals p75 by screen and device — 14 days',
      size: 'half',
      query: hogql(
        `SELECT ${ROUTE} AS route, properties.$device_type AS device, count() AS samples,
                round(quantile(0.75)(toFloat(properties.$web_vitals_LCP_value))) AS lcp_ms,
                round(quantile(0.75)(toFloat(properties.$web_vitals_INP_value))) AS inp_ms,
                round(quantile(0.75)(toFloat(properties.$web_vitals_CLS_value)), 3) AS cls
         FROM events WHERE ${HUMANS} AND event = '$web_vitals' AND timestamp > now() - INTERVAL 14 DAY
         GROUP BY route, device HAVING samples >= 10 ORDER BY samples DESC LIMIT 25`
      ),
    },
  ],
}

export const DASHBOARDS = [live, weekly, growth]
