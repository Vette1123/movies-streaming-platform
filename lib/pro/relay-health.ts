/**
 * Can the Reely Player play right now? The server's one answer.
 *
 * The player resolves every stream through reely-resolver-relay, which walks a
 * provider we do not control. When the provider shuts the relay out (it did on
 * 2026-11-13: `invalid api token` on every resolve), every Reely play boots
 * into a dead frame and only then falls back. This asks the relay's own
 * /selftest - the walk the hourly canary makes, judged by the same helper - so
 * the site can stop offering the player BEFORE anybody presses play.
 *
 * Since 2026-11-19 the chain has two homes, and this walks them exactly as the
 * player does: the Oracle primary first, Netlify's relay-b only when relay 1
 * did not reach a segment. One healthy home means one walk; a total primary
 * outage is the one time the fallback's /selftest is spent, and the answer is
 * still cached per colo (HEALTH_TTL_S) either way. Without the second walk a
 * dead VM would hide the player site-wide while relay-b was still serving.
 *
 * Read by the Worker's GET /api/stream/health (the switcher and source choice)
 * and by POST /api/pro/ticket (so a free trial is never spent on it while it is
 * down). Both go through one per-colo cached answer, see `HEALTH_TTL_S`.
 */

import {
  HEALTH_QUERY,
  RELAY_2_URL,
  RELAY_URL,
  relayUp,
  selftestReason,
} from '@/scripts/lib/relay-selftest.mjs'

export interface RelayHealth {
  up: boolean
  /** Why it is down, in one line; absent when up. */
  reason?: string
}

/**
 * The per-title answer: the relay's verdict composed with library membership.
 * Tier 0 carries no relay hop, so a title in our own library plays with the
 * relay down - the health answer must say so, or the switcher hides the one
 * thing that works during a provider outage.
 */
export interface ReelyHealth extends RelayHealth {
  /** The exact title asked about is in the own library. */
  library: boolean
}

export const composeReelyHealth = (
  relay: RelayHealth,
  inLibrary: boolean
): ReelyHealth =>
  inLibrary ? { up: true, library: true } : { ...relay, library: false }

/**
 * How long one answer stands, per Cloudflare colo. Five minutes: short enough
 * that a recovery reaches supporters well inside the canary's hour, long
 * enough that the walk (one real segment through the provider when healthy)
 * costs each colo at most twelve walks an hour.
 */
export const HEALTH_TTL_S = 300

/** A healthy walk takes a few seconds; one that has not answered by 12s is not playing for anybody either. */
const TIMEOUT_MS = 12_000

/** One base, trimmed and without its trailing slash. */
const rootOf = (base: string | undefined, fallback: string): string =>
  (base?.trim() || fallback).replace(/\/$/, '')

/**
 * Walk one relay home. Never throws: an unreachable or unparseable relay is a
 * down relay, because a play would meet exactly the same thing.
 */
async function walkRelay(
  root: string,
  fetcher: typeof fetch
): Promise<RelayHealth> {
  try {
    const res = await fetcher(`${root}/selftest?${HEALTH_QUERY}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const text = await res.text()
    let stages: unknown
    try {
      stages = JSON.parse(text)
    } catch {
      return {
        up: false,
        reason: `/selftest answered ${res.status}: ${text.slice(0, 120)}`,
      }
    }
    if (relayUp(stages)) return { up: true }
    return { up: false, reason: String(selftestReason(stages)).slice(0, 200) }
  } catch (error) {
    return { up: false, reason: String(error).slice(0, 200) }
  }
}

/**
 * Walk the relay homes in the player's order, deduped. Up as soon as one
 * reaches a real segment; when every home fails, the first home's reason is
 * the answer (that is the one supporters would have met first).
 */
export async function checkRelayHealth(
  base: string | undefined = RELAY_URL,
  fetcher: typeof fetch = fetch,
  fallbackBase: string | undefined = RELAY_2_URL
): Promise<RelayHealth> {
  const roots = [
    rootOf(base, RELAY_URL),
    rootOf(fallbackBase, RELAY_2_URL),
  ].filter((root, i, all) => all.indexOf(root) === i)

  let first: RelayHealth = { up: false, reason: 'no relay configured' }
  for (const [i, root] of roots.entries()) {
    const health = await walkRelay(root, fetcher)
    if (health.up) return health
    if (i === 0) first = health
  }
  return first
}
