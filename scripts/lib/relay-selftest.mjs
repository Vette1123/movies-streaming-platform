// How to read the relay's /selftest answer. One copy, two readers:
// scripts/relay-canary.mjs (hourly, in CI) and the Worker's
// /api/stream/health (lib/pro/relay-health.ts), which decides whether the site
// offers the Reely Player at all. If they disagreed, the canary could page
// about an outage the site was still sending supporters into.

/**
 * The relay the player resolves through FIRST — the worker pairs it with
 * `RELAY_SECRET` at RELAY_URLS position 1. Since 2026-11-17 the relay code
 * runs on a Netlify Edge Function (the old home, the `reely` org on Deno
 * Deploy, was suspended org-wide on 2026-11-16, and Deno Deploy itself
 * sunsets ~April 2027). The address here is NOT the netlify.app host: the
 * relay's /file URLs are handed to the browser's video element, and some
 * ISPs TCP-block *.netlify.app, so `reely-relay-front` (a Cloudflare pipe
 * worker) fronts it at this hostname — browsers hit CF's edge, the vault
 * still sees Netlify's egress. The player worker, the site's health gate
 * and the canary all resolve through this same front.
 */
export const RELAY_URL = 'https://relay.reely.space'

/**
 * The failover relay: a SECOND Netlify site running the identical edge
 * bundle under its own key (paired as the player's RELAY_SECRET_2). It exists
 * because a single relay home is a single failure domain: a Netlify-wide
 * problem would otherwise leave no relay at all, and the player hops here
 * when relay 1 is cooling or down. Same account (a second free account was
 * not worth the setup), so it shares the account-level risks and covers
 * site-level ones: a bad deploy on relay 1, an accidental delete or privacy
 * flip, isolate churn. Browsers reach it through the same front worker, at
 * the second custom domain — the ISP block argument applies to this host
 * exactly as it did to relay 1.
 */
export const RELAY_2_URL = 'https://relay-b.reely.space'

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
 * The vault refused this egress's Range read - degradation, not a broken
 * relay. The walk itself succeeded (the title is carried and resolved:
 * master is a file, resolvedIn elapsed) and only the 1KB byte proof was
 * refused, 429 in ~25ms. Measured 2026-11-18: the mbVault family
 * (bcdnxw.hakunaymatata.com) answers 429 to Range reads from both Netlify
 * relays' egress while the mwVault family (bcdn.hakunaymatata.com) serves,
 * and relay 3's Deno egress - the one that used to serve mbVault - is
 * suspended. A viewer cannot play such a title today; the canary witnesses
 * that hourly WITHOUT paging (polling only feeds the limiter, and an
 * outage issue per hour for a partial degradation is alarm fatigue), and
 * pages the moment a hard failure or a whole-board refusal appears.
 */
export function vaultRefused(stages) {
  return Boolean(stages?.master?.isFile && stages?.segment?.status === 429)
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
