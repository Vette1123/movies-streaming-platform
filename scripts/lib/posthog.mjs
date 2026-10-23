// The one door every PostHog script goes through (same shape as masareef's and
// rafiq's scripts/lib/posthog.mjs).
//
// Reads host, project and personal key from `.env.local`, runs HogQL with the
// async handshake this project needs (a synchronous POST to /query/ 504s for any
// window wider than ~3 days), and refuses a truncated result: HogQL silently
// cuts at 100 rows without a LIMIT, and a cut table reads like "never fired".
import process from 'node:process'

import { loadLocalEnv } from '../load-env.mjs'

loadLocalEnv()

/**
 * The bot block landed on 2026-09-02: before it, ~63% of ingestion was a
 * headless fleet and every aggregate crossing the date measures scrapers.
 */
export const HUMAN_TRAFFIC_SINCE = '2026-09-02'

/** Our own and test browsers — the project's "Internal / Test users" cohort. */
export const TEST_COHORT_ID = 173293

/**
 * The near-square desktop fleet (lib/posthog-client isSquareScreenFleet), for
 * events captured before the client started dropping it: desktop screens with
 * height/width 0.85-0.95 were 976 "people" and zero plays over 14 days.
 * TRUE for an event to KEEP. Also applied as a project test-account filter by
 * posthog:setup, so Trends and Funnels drop it too.
 */
export const NOT_FLEET = `NOT (properties.$os IN ('Windows', 'Mac OS X', 'Linux') AND ifNull(toFloat(properties.$screen_height) / nullIf(toFloat(properties.$screen_width), 0), 0) BETWEEN 0.85 AND 0.95)`

/**
 * Drop-in WHERE clause for "people, not us and not a bot fleet".
 * Expand `{humans}` in any query with it.
 */
export const HUMANS = `timestamp > toDateTime('${HUMAN_TRAFFIC_SINCE}') AND (person_id IS NULL OR person_id NOT IN COHORT ${TEST_COHORT_ID}) AND ${NOT_FLEET}`

const POLL_MS = 2000
const POLL_LIMIT = 90

export function posthogConfig() {
  // The PRIVATE API host. NEXT_PUBLIC_POSTHOG_HOST is the ingest host
  // (eu.i.posthog.com), which happens to proxy /query/ but not everything.
  const host = (process.env.POSTHOG_HOST || 'https://eu.posthog.com').replace(
    /\/$/,
    ''
  )
  const project = process.env.POSTHOG_PROJECT_ID || '216915'
  const key = process.env.POSTHOG_API_KEY
  if (!key) {
    throw new Error(
      'POSTHOG_API_KEY is not set. Add it to .env.local — a personal API key (phx_…), not the public ingest key.'
    )
  }
  return { host, project, key }
}

/**
 * fetch against the private API, JSON in and out. A 403 names the missing
 * scope so the fix is one click in PostHog's key settings.
 */
export async function phApi(cfg, path, { method = 'GET', body } = {}) {
  const url = path.startsWith('/api/')
    ? `${cfg.host}${path}`
    : `${cfg.host}/api/projects/${cfg.project}${path}`
  let res
  for (let attempt = 1; ; attempt += 1) {
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      break
    } catch (error) {
      if (attempt >= 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 400) }
  }
  if (!res.ok) {
    const detail =
      json?.query_status?.error_message ||
      json?.detail ||
      json?.raw ||
      JSON.stringify(json).slice(0, 400)
    throw new Error(`PostHog ${method} ${path} → ${res.status}: ${detail}`)
  }
  return json
}

/** Every page of a paginated list endpoint. */
export async function phList(cfg, path) {
  const out = []
  let next = path.includes('?') ? `${path}&limit=200` : `${path}?limit=200`
  for (let page = 0; next && page < 50; page += 1) {
    const body = await phApi(cfg, next)
    out.push(...(body.results || []))
    next = body.next ? body.next.replace(cfg.host, '') : null
  }
  return out
}

/**
 * Run HogQL and return rows as objects. `{humans}` expands to HUMANS.
 * Throws on a truncated result — always write an explicit LIMIT.
 */
export async function runQuery(cfg, sql) {
  const query = sql.replaceAll('{humans}', HUMANS)
  let body = await phApi(cfg, '/query/', {
    method: 'POST',
    body: { query: { kind: 'HogQLQuery', query }, refresh: 'async' },
  })
  const id = body.query_status?.id || body.id
  for (let i = 0; i < POLL_LIMIT; i += 1) {
    const status = body.query_status || body
    if (status.complete || body.results) break
    if (!id) break
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    body = await phApi(cfg, `/query/${id}/`)
    const failure = body.query_status?.error || body.error
    if (failure) {
      throw new Error(
        `PostHog query failed: ${body.query_status?.error_message || body.error_message || 'unknown'}`
      )
    }
  }
  const payload = body.query_status?.results ?? body
  const rows = payload.results || body.results
  if (!rows) {
    throw new Error(
      `Query did not finish within ${(POLL_LIMIT * POLL_MS) / 1000}s. Narrow the window.`
    )
  }
  if (payload.hasMore || body.hasMore) {
    throw new Error(
      `Query result was truncated at ${rows.length} rows — add or raise the LIMIT.`
    )
  }
  const columns = payload.columns || body.columns || []
  return rows.map((row) =>
    Object.fromEntries(columns.map((column, i) => [column, row[i]]))
  )
}

/** Pipe-separated table, long cells cut, nulls as "-". */
export function printTable(rows) {
  if (!rows.length) {
    console.log('(no rows)')
    return
  }
  const cell = (value) => {
    if (value === null || value === undefined) return '-'
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return text.length > 150 ? `${text.slice(0, 147)}...` : text
  }
  const columns = Object.keys(rows[0])
  console.log(columns.join(' | '))
  for (const row of rows)
    console.log(columns.map((c) => cell(row[c])).join(' | '))
}
