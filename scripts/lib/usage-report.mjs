// Pure halves of `pnpm posthog:usage` (tests/usage-report.test.ts).

/**
 * EVENT_AREA and FEATURE_AREA out of lib/analytics.ts, read as text: the
 * script must not need a TypeScript toolchain, and the analytics module is
 * the one source of truth (masareef's posthog-usage reads track.ts the same way).
 *
 * @param {string} source
 * @returns {{ eventArea: Record<string, string>, featureArea: Record<string, string> }}
 */
export function areaTables(source) {
  /** @param {string} name */
  const block = (name) => {
    const start = source.indexOf(`export const ${name} = {`)
    if (start === -1) throw new Error(`${name} not found in lib/analytics.ts`)
    const end = source.indexOf('}', start)
    /** @type {Record<string, string>} */
    const map = {}
    for (const match of source
      .slice(start, end)
      .matchAll(/^\s+([a-z_$]+): '([a-z]+)',/gm)) {
      map[match[1]] = match[2]
    }
    return map
  }
  return { eventArea: block('EVENT_AREA'), featureArea: block('FEATURE_AREA') }
}

/** The area an (event, feature) row reports under. */
export function areaOf(row, tables) {
  if (row.event === 'feature_used' && row.feature) {
    return tables.featureArea[row.feature] ?? 'discover'
  }
  return tables.eventArea[row.event] ?? null
}

/**
 * Reach per area as a share of active people, now vs the previous window.
 * Per-area people is the MAX over its events — a lower bound, because one
 * person using two events of an area is counted once either way.
 */
export function areaReach(rows, tables, active, activeBefore) {
  const areas = {}
  for (const row of rows) {
    const area = areaOf(row, tables)
    if (!area) continue
    const entry = (areas[area] ??= { area, people: 0, before: 0 })
    entry.people = Math.max(entry.people, Number(row.people) || 0)
    entry.before = Math.max(entry.before, Number(row.people_before) || 0)
  }
  return Object.values(areas)
    .map((entry) => ({
      ...entry,
      share: active ? entry.people / active : 0,
      share_before: activeBefore ? entry.before / activeBefore : 0,
    }))
    .sort((a, b) => b.people - a.people)
}

/** Events defined in EVENT_AREA that no human sent in the window. */
export function neverFired(rows, tables) {
  const seen = new Set(
    rows.filter((r) => Number(r.people) > 0).map((r) => r.event)
  )
  return Object.keys(tables.eventArea).filter((event) => !seen.has(event))
}

const pct = (n) => `${Math.round(n * 100)}%`

/**
 * Rule-of-thumb actions, ranked. Each one names the number that tripped it so
 * the line can be checked instead of trusted.
 */
export function whatToDo({ reach, activation, player, support, rage }) {
  const out = []
  if (activation.new_people >= 20 && activation.rate < 0.25) {
    out.push(
      `Only ${pct(activation.rate)} of ${activation.new_people} new visitors played something — the landing → play path is the biggest lever (first_play).`
    )
  }
  for (const source of player) {
    const rate = source.plays ? source.failures / source.plays : 0
    if (source.failures >= 10 && rate > 0.3) {
      out.push(
        `Server "${source.source}" failed ${source.failures} times against ${source.plays} plays (${pct(rate)}) — check it with pnpm embed:probe or move it down the list.`
      )
    }
  }
  for (const area of reach) {
    if (area.share_before > 0.05 && area.share < area.share_before * 0.7) {
      out.push(
        `"${area.area}" reach fell from ${pct(area.share_before)} to ${pct(area.share)} of active people — something in it may have broken.`
      )
    }
  }
  if (support.cta >= 10 && support.checkout === 0) {
    out.push(
      `${support.cta} people clicked a support CTA and nobody started checkout — the /support page is losing them.`
    )
  }
  const hot = rage[0]
  if (hot && Number(hot.c) >= 10) {
    out.push(
      `Rageclick hotspot: ${hot.route} (${hot.c}) — watch a replay there.`
    )
  }
  return out
}
