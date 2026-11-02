// Project-agnostic builders for PostHog dashboards, insights and alerts —
// the reusable half of `pnpm posthog:setup`. A project supplies only a spec
// (scripts/posthog-dashboards.mjs); everything here is the same in every repo.
//
// Idempotent by NAME: an insight or dashboard that already exists is updated
// in place, never duplicated, so the script is safe to re-run after every
// change to the spec. Managed insights carry MANAGED in their description so a
// hand-made insight with the same name is never overwritten.
import { phApi, phList } from './posthog.mjs'

// Older runs wrote this into every description, where PostHog printed it under
// each tile title. An insight now counts as ours when it carries it (legacy)
// or already sits on a board the spec owns: the spec decides everything on
// those boards anyway, and a hand-made twin elsewhere is still never touched.
export const MANAGED = '[managed by pnpm posthog:setup]'

/** Pure: may setup rewrite this insight for a tile headed to `dashboardIds`? */
export const isManaged = (insight, dashboardIds) =>
  (insight.description ?? '').includes(MANAGED) ||
  (insight.dashboards ?? []).some((id) => dashboardIds.includes(id))

// ---- Query builders ---------------------------------------------------------

/**
 * A HogQL tile. display: BoldNumber | ActionsTable | ActionsLineGraph |
 * ActionsBar | ActionsStackedBar | ActionsPie.
 * A chart needs `axes: { x: 'day', y: ['people', 'plays'] }`: without them
 * PostHog folds every row into one point (a 30-day line drew a single dot).
 */
export const hogql = (query, display = 'ActionsTable', axes) => ({
  kind: 'DataVisualizationNode',
  source: { kind: 'HogQLQuery', query },
  display,
  ...(axes
    ? {
        chartSettings: {
          xAxis: { column: axes.x },
          yAxis: axes.y.map((column) => ({ column })),
          showLegend: axes.y.length > 1,
        },
      }
    : {}),
})

const events = (list) =>
  list.map((entry) => {
    const item = typeof entry === 'string' ? { event: entry } : entry
    return {
      kind: 'EventsNode',
      event: item.event ?? null,
      name: item.name ?? item.event ?? 'All events',
      math: item.math ?? 'total',
      ...(item.math_property ? { math_property: item.math_property } : {}),
      ...(item.properties ? { properties: item.properties } : {}),
    }
  })

// Displays that draw a value on every bar/slice rather than a line.
const LABELLED = new Set(['ActionsBar', 'ActionsBarValue', 'ActionsPie'])

/**
 * A Trends tile. display: ActionsLineGraph | ActionsAreaGraph | ActionsBar |
 * ActionsBarValue | ActionsPie | BoldNumber | WorldMap | ActionsTable.
 * `compare` draws the previous period beside it (a BoldNumber shows the % change).
 */
export const trends = ({
  series,
  interval = 'day',
  from = '-30d',
  display = 'ActionsLineGraph',
  breakdown,
  breakdownType = 'event',
  formula,
  compare = false,
  postfix,
  decimals,
}) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'TrendsQuery',
    series: events(series),
    interval,
    dateRange: { date_from: from },
    filterTestAccounts: true,
    ...(compare ? { compareFilter: { compare: true } } : {}),
    trendsFilter: {
      display,
      ...(formula ? { formula } : {}),
      ...(postfix ? { aggregationAxisPostfix: postfix } : {}),
      ...(decimals !== undefined ? { decimalPlaces: decimals } : {}),
      showValuesOnSeries: LABELLED.has(display),
    },
    ...(breakdown
      ? {
          breakdownFilter: {
            breakdown,
            breakdown_type: breakdownType,
            breakdown_limit: 15,
          },
        }
      : {}),
  },
})

export const funnel = ({
  steps,
  from = '-30d',
  windowDays = 1,
  breakdown,
}) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'FunnelsQuery',
    series: events(steps),
    dateRange: { date_from: from },
    filterTestAccounts: true,
    funnelsFilter: {
      funnelVizType: 'steps',
      funnelOrderType: 'ordered',
      funnelWindowInterval: windowDays,
      funnelWindowIntervalUnit: 'day',
      layout: 'horizontal',
    },
    ...(breakdown
      ? { breakdownFilter: { breakdown, breakdown_type: 'event' } }
      : {}),
  },
})

export const retention = ({
  start,
  returning,
  period = 'Week',
  intervals = 8,
}) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'RetentionQuery',
    dateRange: { date_from: `-${intervals * 7}d` },
    filterTestAccounts: true,
    retentionFilter: {
      period,
      totalIntervals: intervals,
      targetEntity: { id: start, type: 'events', name: start },
      returningEntity: { id: returning, type: 'events', name: returning },
      retentionType: 'retention_first_time',
    },
  },
})

export const lifecycle = ({
  event = '$pageview',
  interval = 'week',
  from = '-90d',
}) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'LifecycleQuery',
    series: events([event]),
    interval,
    dateRange: { date_from: from },
    filterTestAccounts: true,
  },
})

// ---- Layout -----------------------------------------------------------------

/**
 * Tile sizes on PostHog's 12-column grid (h is in ~80px rows). A tile picks one
 * with `size`; the default suits a chart.
 */
export const SIZES = {
  kpi: { w: 3, h: 3 },
  third: { w: 4, h: 5 },
  half: { w: 6, h: 5 },
  wide: { w: 8, h: 5 },
  full: { w: 12, h: 5 },
  tall: { w: 6, h: 7 },
  table: { w: 12, h: 7 },
}
const DEFAULT_SIZE = 'half'

/** A full-width markdown header that starts a new block of tiles. */
export const section = (title, note) => ({ section: title, note })

// One row, one line: a heading over a note needs two rows and leaves dead
// space, and a heading and note squeezed into one row scroll. So the note
// rides on the heading line.
const sectionSize = () => ({ w: 12, h: 1 })

export const sectionBody = ({ section: title, note }) =>
  note ? `### ${title} — ${note}` : `### ${title}`

/**
 * Pack a board's items left to right into the 12-column grid. A row wraps
 * when the next tile does not fit, and a section always opens a new row, so
 * the dashboard reads top to bottom in spec order. Pure: returns
 * `{ item, layout: { x, y, w, h } }` for every item.
 */
export function layoutTiles(items) {
  const placed = []
  let x = 0
  let y = 0
  let rowH = 0
  const newRow = () => {
    y += rowH
    x = 0
    rowH = 0
  }
  for (const item of items) {
    const size = item.section
      ? sectionSize(item)
      : SIZES[item.size ?? DEFAULT_SIZE]
    if (!size)
      throw new Error(`unknown tile size "${item.size}" on ${item.name}`)
    if (item.section || x + size.w > 12) newRow()
    placed.push({ item, layout: { x, y, ...size } })
    x += size.w
    rowH = Math.max(rowH, size.h)
    if (item.section) newRow()
  }
  return placed
}

/**
 * Make a dashboard hold exactly `placed` — section cards and insight tiles at
 * their layouts — and nothing else. Tiles the spec does not name are taken OFF
 * the dashboard (the insight itself stays in the project library), which is
 * how hand-made tiles stop piling up between the managed ones.
 * `insightIds` maps tile name to insight id. Returns how many tiles it removed.
 */
export async function syncDashboardTiles(cfg, dashboardId, placed, insightIds) {
  const board = await phApi(cfg, `/dashboards/${dashboardId}/`)
  const live = board.tiles.filter((t) => !t.deleted)
  const byInsight = new Map(
    live.filter((t) => t.insight).map((t) => [t.insight.id, t])
  )
  const texts = live.filter((t) => t.text)
  const keep = new Set()
  const tiles = []
  for (const { item, layout } of placed) {
    const layouts = { sm: layout }
    if (item.section) {
      const body = sectionBody(item)
      const reuse = texts.find((t) => !keep.has(t.id) && t.text.body === body)
      if (reuse) {
        keep.add(reuse.id)
        tiles.push({ id: reuse.id, layouts })
      } else tiles.push({ text: { body }, layouts })
      continue
    }
    const tile = byInsight.get(insightIds.get(item.name))
    if (!tile)
      throw new Error(`"${item.name}" is not on dashboard ${dashboardId}`)
    keep.add(tile.id)
    tiles.push({ id: tile.id, layouts })
  }
  const stale = live.filter((t) => !keep.has(t.id))
  for (const t of stale) tiles.push({ id: t.id, deleted: true })
  await phApi(cfg, `/dashboards/${dashboardId}/`, {
    method: 'PATCH',
    body: { tiles },
  })
  return stale.length
}

// ---- Upserts ----------------------------------------------------------------

export async function loadState(cfg) {
  const [dashboards, insights] = await Promise.all([
    phList(cfg, '/dashboards/'),
    phList(cfg, '/insights/?saved=true'),
  ])
  return {
    dashboards: dashboards.filter((d) => !d.deleted),
    insights: insights.filter((i) => !i.deleted),
  }
}

export async function upsertDashboard(
  cfg,
  state,
  { name, description, renameFrom }
) {
  const existing =
    state.dashboards.find((d) => d.name === name) ??
    (renameFrom
      ? state.dashboards.find((d) => d.name === renameFrom)
      : undefined)
  const body = { name, description, pinned: true }
  if (existing) {
    await phApi(cfg, `/dashboards/${existing.id}/`, { method: 'PATCH', body })
    return { id: existing.id, created: false }
  }
  const created = await phApi(cfg, '/dashboards/', { method: 'POST', body })
  state.dashboards.push(created)
  return { id: created.id, created: true }
}

/**
 * Create or update one insight and put it on exactly `dashboardIds` — the
 * boards the spec names it on. A managed insight the spec moved is taken off
 * its old board here; merging with the old list put it straight back.
 * Refuses to touch an insight of the same name that this script did not create.
 */
export async function upsertInsight(cfg, state, dashboardIds, tile) {
  const existing = state.insights.find(
    (i) => i.name === tile.name && isManaged(i, dashboardIds)
  )
  const body = {
    name: tile.name,
    description: tile.description ?? '',
    query: tile.query,
    dashboards: dashboardIds,
  }
  if (existing) {
    await phApi(cfg, `/insights/${existing.id}/`, { method: 'PATCH', body })
    return { id: existing.id, created: false }
  }
  const created = await phApi(cfg, '/insights/', { method: 'POST', body })
  state.insights.push(created)
  return { id: created.id, created: true }
}

/**
 * An alert on a Trends insight's first series. `lower` = silence tripwire
 * (fires when the value drops under it), `upper` = spike.
 */
export async function upsertAlert(
  cfg,
  existingAlerts,
  { name, insightId, lower, upper, subscriberId }
) {
  const body = {
    name,
    insight: insightId,
    enabled: true,
    calculation_interval: 'daily',
    condition: { type: 'absolute_value' },
    threshold: {
      configuration: {
        type: 'absolute',
        bounds: {
          ...(lower !== undefined ? { lower } : {}),
          ...(upper !== undefined ? { upper } : {}),
        },
      },
    },
    config: {
      type: 'TrendsAlertConfig',
      series_index: 0,
      check_ongoing_interval: false,
    },
    subscribed_users: subscriberId ? [subscriberId] : [],
  }
  const existing = existingAlerts.find((a) => a.name === name)
  if (existing) {
    await phApi(cfg, `/alerts/${existing.id}/`, { method: 'PATCH', body })
    return { id: existing.id, created: false }
  }
  const created = await phApi(cfg, '/alerts/', { method: 'POST', body })
  return { id: created.id, created: true }
}

/** Turn "filter out internal and test users" on for an existing insight. */
export async function enforceTestFilter(cfg, insight) {
  const source = insight.query?.source
  if (!source || insight.query.kind !== 'InsightVizNode') return false
  if (source.filterTestAccounts === true) return false
  await phApi(cfg, `/insights/${insight.id}/`, {
    method: 'PATCH',
    body: {
      query: {
        ...insight.query,
        source: { ...source, filterTestAccounts: true },
      },
    },
  })
  return true
}
