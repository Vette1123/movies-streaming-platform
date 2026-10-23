// Project-agnostic builders for PostHog dashboards, insights and alerts —
// the reusable half of `pnpm posthog:setup`. A project supplies only a spec
// (scripts/posthog-dashboards.mjs); everything here is the same in every repo.
//
// Idempotent by NAME: an insight or dashboard that already exists is updated
// in place, never duplicated, so the script is safe to re-run after every
// change to the spec. Managed insights carry MANAGED in their description so a
// hand-made insight with the same name is never overwritten.
import { phApi, phList } from './posthog.mjs'

export const MANAGED = '[managed by pnpm posthog:setup]'

// ---- Query builders ---------------------------------------------------------

/** A HogQL tile. display: BoldNumber | ActionsTable | ActionsLineGraph | ActionsBar | ActionsPie */
export const hogql = (query, display = 'ActionsTable') => ({
  kind: 'DataVisualizationNode',
  source: { kind: 'HogQLQuery', query },
  display,
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

export const trends = ({
  series,
  interval = 'day',
  from = '-30d',
  display = 'ActionsLineGraph',
  breakdown,
  breakdownType = 'event',
  formula,
}) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'TrendsQuery',
    series: events(series),
    interval,
    dateRange: { date_from: from },
    filterTestAccounts: true,
    trendsFilter: {
      display,
      ...(formula ? { formula } : {}),
      showValuesOnSeries: display !== 'ActionsLineGraph',
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
 * Create or update one insight on one dashboard. Refuses to touch an insight
 * of the same name that this script did not create.
 */
export async function upsertInsight(cfg, state, dashboardId, tile) {
  const description = `${tile.description ?? ''} ${MANAGED}`.trim()
  const existing = state.insights.find(
    (i) => i.name === tile.name && (i.description ?? '').includes(MANAGED)
  )
  const body = { name: tile.name, description, query: tile.query }
  if (existing) {
    const dashboards = new Set([...(existing.dashboards ?? []), dashboardId])
    await phApi(cfg, `/insights/${existing.id}/`, {
      method: 'PATCH',
      body: { ...body, dashboards: [...dashboards] },
    })
    return { id: existing.id, created: false }
  }
  const created = await phApi(cfg, '/insights/', {
    method: 'POST',
    body: { ...body, dashboards: [dashboardId] },
  })
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
