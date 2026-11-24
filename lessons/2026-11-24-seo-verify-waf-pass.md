# seo:verify reads tail pages through the WAF pass

## What

`pnpm seo:verify` failed 10 of 71 checks: every tail page (`/movies/9340`, `/collection/10`,
`/collection/10194`) came back 403 with no title, h1 or canonical. The 403 was Cloudflare's
managed challenge (`cf-mitigated: challenge`), the WAF rule that challenges every client on
Worker pages. The script sent a browser UA and nothing else. `indexnow.mjs` and
`submit-sitemaps.mjs` each built the `x-reely-ci` pass inline; verify-seo was the third
reader and had no pass. `scripts/lib/site-headers.mjs` now builds the headers for all three,
and verify-seo loads `.env.local`. Result: 71/71 against production.

## Mistakes

- The 403 read like an outage of the tail. Googlebot was never affected: `cf:health` showed 0
  blocked/failed crawler requests, and verified bots skip the rule by design. Check
  `cf-mitigated` before treating a 403 as a site failure.
- The `x-reely-ci` header was copied into two scripts instead of shared, so the third reader
  missed it. Second copy should have extracted.

## What worked

- `curl -D -` on one failing URL: `Cf-Mitigated: challenge` named the cause in one call.
- GSC still shows ~6-14% of impressions on apex URLs. Apex 301s to www, canonical, og:url and
  sitemaps are all www, and the redirect exemption is path-only, so Googlebot is redirected
  too. That's Google consolidating old apex links, and there's nothing to fix.

## Rules

- A script that reads our live pages takes its headers from `siteHeaders()`
  (`tests/site-headers.test.ts` pins the three readers).
