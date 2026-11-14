// How to read the relay's /selftest answer. One copy, two readers:
// scripts/relay-canary.mjs (hourly, in CI) and the Worker's
// /api/stream/health (lib/pro/relay-health.ts), which decides whether the site
// offers the Reely Player at all. If they disagreed, the canary could page
// about an outage the site was still sending supporters into.

/** The relay the player resolves through. Public: the canary names it too. */
export const RELAY_URL = 'https://reely-resolver-relay.reely.deno.net'

/** The title the health check walks: long-running and widely carried. */
export const HEALTH_QUERY = 'ty=movie&id=550'

/**
 * A /selftest answer is a pass only when the walk reached a real segment.
 * `ok: true` alone means nothing threw; the segment status is the proof.
 */
export function selftestPassed(stages) {
  return Boolean(
    stages?.ok && stages.master?.isM3U && stages.segment?.status === 200
  )
}

/** Why a /selftest answer failed, in one line. */
export function selftestReason(stages) {
  if (!stages) return 'no answer'
  if (stages.coolingFor) return `rate-limited, cooling ${stages.coolingFor}s`
  if (stages.error) return stages.error
  if (!stages.master?.isM3U) return 'master is not a playlist'
  return `segment ${stages.segment?.status ?? 'missing'}`
}

/**
 * Whether the site should offer the player, from one /selftest answer.
 *
 * A cooling relay is NOT down: it walked recently and got rate-limited, which
 * clears in about 90s, and the canary waits it out for the same reason. Taking
 * the player away from every supporter for a 90-second cooldown would be the
 * fallback causing the outage. Anything else that did not reach a segment is.
 */
export function relayUp(stages) {
  if (stages?.coolingFor) return true
  return selftestPassed(stages)
}
