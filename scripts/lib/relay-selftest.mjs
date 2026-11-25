// How to read the relay's /selftest answer. One copy, two readers:
// scripts/relay-canary.mjs (hourly, in CI) and the Worker's
// /api/stream/health (lib/pro/relay-health.ts), which decides whether the site
// offers the Reely Player at all. If they disagreed, the canary could page
// about an outage the site was still sending supporters into.

/**
 * The relay the player resolves through FIRST — the worker pairs it with
 * `RELAY_SECRET` at RELAY_URLS position 1. Since 2026-11-19 it runs on an
 * Oracle Cloud Always Free VM behind the Cloudflare Tunnel `reely-oracle-b`
 * (the Deno org was suspended org-wide on 2026-11-16, and Netlify's shared
 * egress was refused by the vault). The address here is NOT the tunnel host:
 * the relay's /file URLs are handed to the browser's video element, so
 * `reely-relay-front` (a Cloudflare pipe worker) fronts it at this hostname —
 * browsers hit CF's edge, the vault still sees the VM's egress. The player
 * worker, the site's health gate and the canary all resolve through this
 * same front.
 */
export const RELAY_URL = 'https://relay.reely.space'

/**
 * The cold fallback (relay-b): the same Deno relay on Netlify Edge
 * Functions, reached by browsers through the second front hostname. It runs
 * under its own key, paired as the player's `RELAY_SECRET_2`. A separately
 * hosted home is the point: an Oracle outage, a bad VM deploy or a tunnel
 * failure takes relay 1 down without taking relay-b with it, and the player
 * hops here when relay 1 is cooling or down. Netlify's 300-credit pool is
 * the fallback's only budget (setup: the relay repo's NETLIFY.md).
 */
export const RELAY_2_URL = 'https://relay-b.reely.space'

/**
 * The titles the provider walks, and what each one is for.
 *
 * The vault family a title mints to is per-title and stable (surveyed
 * 2026-11-18): bcdnxw.hakunaymatata.com (mbVault) refuses this chain's Range
 * reads with 429 while bcdn.hakunaymatata.com (mwVault) serves them. One
 * title stays on the refusing family as the degradation witness; the others
 * prove the byte path on the serving family.
 *
 * `degraded: true` marks the witness. The site's health gate must never walk
 * it: on 2026-11-25 the gate was pinned to 550, so one refused title answered
 * "relay down" for every title and /api/pro/ticket 503'd the whole player.
 * A gate is a sample - sample the family that plays.
 */
export const TITLES = [
  { name: 'Fight Club', query: 'ty=movie&id=550', degraded: true },
  { name: 'The Dark Knight', query: 'ty=movie&id=155' },
  { name: 'Inception', query: 'ty=movie&id=27205' },
]

/** The title the health check walks: the first serving-family witness. */
export const HEALTH_QUERY = TITLES.find((title) => !title.degraded).query

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
 * fallback causing the outage.
 *
 * A vault refusal is NOT down either, for the same reason the canary does not
 * page on one: the walk resolved, the title is carried, and only this egress's
 * Range read was refused. Other titles on the serving family still play.
 * Refusing the whole player over one title's refusal turns a partial
 * degradation into an outage for all of them - which is exactly what happened
 * on 2026-11-25, when the gate walked the witness title and every ticket 503'd.
 * Anything else that did not reach a segment is down.
 */
export function relayUp(stages) {
  if (stages?.coolingFor) return true
  if (vaultRefused(stages)) return true
  return selftestPassed(stages)
}
