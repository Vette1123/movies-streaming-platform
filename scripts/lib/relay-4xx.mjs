// play.reely.space (the Reely Player) and relay.reely.space /
// relay-b.reely.space (its stream relay) answer only their own paths;
// everything else, their root and favicon included, is a 404 by design.
// Without the host these read as "404 /" — the homepage, apparently — and
// were the top unclassified rows on 2026-11-17 (294 + 105 in 24h).
const PLAYER_HOST = /^play\.reely\.space(:\d+)?$/
const RELAY_HOST = /^relay(-[a-z0-9]+)?\.reely\.space(:\d+)?$/

// The relay's own routes (reely-resolver-relay/relay.ts). A 4xx on one of these
// stays unclassified, because there it is news. Everything else on a relay host
// is a scanner: on 2026-11-24 a mobile-casino kit wordlist (`/h5/`,
// `/api/lottery/ranking`, `/kefu/css/style.css`…) was ~450 of the 634
// unclassified rows, a long tail no denylist would ever finish.
// ponytail: mirrors relay.ts by hand; a new relay route 404ing would hide
// here until it is added. Upgrade: export the route list from the relay repo.
const RELAY_ROUTES =
  /^\/(health|page|status|echo|selftest|resolve|egress-probe)$|^\/(pl|seg|file)\//

/**
 * The bucket for a 4xx on the player or relay hosts, or undefined to let the
 * path buckets decide.
 */
export function relayHostBucket(host = '', path = '/') {
  const relay = RELAY_HOST.test(host)
  if (!relay && !PLAYER_HOST.test(host)) return undefined
  // Cloudflare proxies its alternate HTTPS ports (2053, 2083, 2087, 2096,
  // 8443) on every proxied hostname, and port scanners walk them. The player
  // and the canary only use the default port, so an explicit port is a scan.
  if (/:\d+$/.test(host) && !host.endsWith(':443')) {
    return 'player/relay host: port scan on a non-default port (by design)'
  }
  if (/^\/(favicon\.ico|robots\.txt)?$/.test(path)) {
    return 'player/relay host: path it does not serve (404, by design)'
  }
  if (relay && !RELAY_ROUTES.test(path)) {
    return 'bot: wordlist on the relay host, not a relay route (404)'
  }
  return undefined
}
