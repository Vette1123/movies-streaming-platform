// How to read the relay's /selftest answer. One copy, two readers:
// scripts/relay-canary.mjs (hourly, in CI) and the Worker's
// /api/stream/health (lib/pro/relay-health.ts), which decides whether the site
// offers the Reely Player at all. If they disagreed, the canary could page
// about an outage the site was still sending supporters into.

/**
 * The relay the player resolves through FIRST — the worker pairs it with
 * `RELAY_SECRET` at RELAY_URLS position 1. Since 2026-11-17 this is the
 * Netlify Edge Function (https://reely-relay.netlify.app): the old home, the
 * `reely` org on Deno Deploy, was suspended org-wide (ORGANIZATION_SUSPENDED)
 * on 2026-11-16 and Deno Deploy itself sunsets ~April 2027 (Deno joined
 * Cloudflare). The relay code runs unmodified on Netlify's Deno runtime
 * through a Deno.env shim; the vault CDN (bcdn.*) refuses Cloudflare-egress
 * bytes, which is why the relay cannot simply become a CF Worker.
 */
export const RELAY_URL = 'https://reely-relay.netlify.app'

/**
 * The failover relay on the suspended Deno org. It answers 503 SUSPENDED on
 * every route while the org is suspended; if Deno support lifts that, it
 * resumes as free failover with no change on our side (the player pairs it
 * as RELAY_SECRET_2, key K3). The canary walks both so a report says what a
 * play would hit. The site's health gate (lib/pro/relay-health.ts) stays on
 * relay 1 only: with failover the player survives relay 1's death without
 * any gate change, and a second selftest walk per colo per TTL is not worth
 * the Worker subrequests on the route that is 63% of invocations.
 */
export const RELAY_2_URL = 'https://reely-resolver-relay-2.reely.deno.net'

/** The title the health check walks: long-running and widely carried. */
export const HEALTH_QUERY = 'ty=movie&id=550'

/**
 * A /selftest answer is a pass only when the walk reached a real segment.
 * `ok: true` alone means nothing threw; the segment status is the proof.
 *
 * Two walks pass: the HLS one (vidsrcme — a rewritten playlist whose segment
 * fetch answered 200) and the progressive-file one (vidlink — a bare ranged
 * request at a signed mp4 that answered 200 or 206 video/*).
 */
export function selftestPassed(stages) {
  return Boolean(
    stages?.ok &&
    (stages.master?.isM3U || stages.master?.isFile) &&
    [200, 206].includes(stages.segment?.status)
  )
}

/** Why a /selftest answer failed, in one line. */
export function selftestReason(stages) {
  if (!stages) return 'no answer'
  if (stages.coolingFor) return `rate-limited, cooling ${stages.coolingFor}s`
  if (stages.error) return stages.error
  if (!stages.master?.isM3U && !stages.master?.isFile)
    return 'master is neither a playlist nor a file'
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
