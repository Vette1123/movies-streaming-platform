# cf:health files relay-host scanners by route, not by wordlist

## What

Daily sweep, 2026-11-24: PostHog 0 open; cf:health 4/6 (CPU p99 9.4ms gauge, 19 of 141,904
eyeball 5xx = 0.013%, under the 0.05% gate); seo:verify 71/71; GSC read 8 sitemaps with 0
errors; Bing 0 crawl issues, 110k indexed. Request Indexing hit "Quota exceeded" on the first
pick, so nothing was logged and the 10 picks carry to tomorrow.

The one fix: 634 rows sat in cf:health's "unclassified" column, nearly all scanners on the
relay host. `scripts/lib/relay-4xx.mjs` now holds the player/relay rule: an explicit
non-443 port is a port scan, and on the relay hosts any path that is not a relay route
(`reely-resolver-relay/relay.ts`) is a wordlist. Unclassified fell to 15, all correct 404s
(deleted TMDB ids, one fake-page probe).

## Mistakes

- First cut was a denylist of the casino-kit paths in the top 12 rows. It filed 200 and left
  449 of the same scanner's long tail. The relay's routes are a closed set; allowlist them.
- `RELAY_HOST` was anchored on `$` with no port, so `relay.reely.space:2096` (the host header
  keeps the port on Cloudflare's alternate HTTPS ports) never matched.
- The first red/green run used a sed that silently failed to edit the port regex, so the port
  case stayed green under "red". Checked the old regex directly instead. Confirm the mutation
  applied before trusting a red run.

## What worked

- Reading the relay repo's `url.pathname ===` checks for the true route list.

## Rules

- A new relay route must be added to `RELAY_ROUTES` (ponytail comment in the module), or its
  404s hide as scanner noise.
