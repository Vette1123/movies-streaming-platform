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
 * Read by the Worker's GET /api/stream/health (the switcher and source choice)
 * and by POST /api/pro/ticket (so a free trial is never spent on it while it is
 * down). Both go through one per-colo cached answer, see `HEALTH_TTL_S`.
 */

import {
  HEALTH_QUERY,
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
 * How long one answer stands, per Cloudflare colo. Five minutes: short enough
 * that a recovery reaches supporters well inside the canary's hour, long
 * enough that the walk (one real segment through the provider when healthy)
 * costs each colo at most twelve walks an hour.
 */
export const HEALTH_TTL_S = 300

/** A healthy walk takes a few seconds; one that has not answered by 12s is not playing for anybody either. */
const TIMEOUT_MS = 12_000

/**
 * Walk the relay once. Never throws: an unreachable or unparseable relay is a
 * down relay, because a play would meet exactly the same thing.
 */
export async function checkRelayHealth(
  base: string | undefined = RELAY_URL,
  fetcher: typeof fetch = fetch
): Promise<RelayHealth> {
  const root = (base?.trim() || RELAY_URL).replace(/\/$/, '')
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
