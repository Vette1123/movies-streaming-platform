# Proving the payment webhook works, against production

**Date:** 2026-08-16

## What

The Buy Me a Coffee webhook had never been fired at production by anything but
Buy Me a Coffee, and nothing had confirmed it worked end to end. Probed the live
endpoint with signed payloads for a throwaway address
(`webhook-probe@reely.space`), asserting on the real D1 row after each delivery
and deleting it afterwards.

Verified live, in this order:

| Case                                         | Result                                                                |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Bad signature                                | `401 bad signature`, no `cf-mitigated` header — the WAF never sees it |
| Valid signature, **empty user-agent**        | `200 ok`, `supporters` row written with `grants=pro`                  |
| Redelivery of the same `event_id`            | Row unchanged                                                         |
| `extra_purchase.created` for the Lifetime    | `lifetime=1`                                                          |
| `membership.cancelled` on a lifetime row     | Grant survives                                                        |
| `membership.cancelled` on a recurring row    | `grants=''`, row kept as a tombstone                                  |
| Stale `started` redelivered after the cancel | Refused — no resurrection                                             |
| Level belonging to a sibling project         | Nothing granted                                                       |
| `GET` on the webhook path                    | `405`, JSON                                                           |

`BMC_WEBHOOK_SECRET` is set on the Worker, and the fact that a signature
generated from `.env.local` verifies in production proves the two copies match —
which is the failure that would otherwise 401 every real payment silently.

## Mistakes

- **The apex host would have eaten deliveries.** `reely.space/api/billing/bmc`
  answered `301` to the `www` host, because the apex→www redirect rule matched
  every path. A webhook sender that does not follow redirects — or that follows
  one by re-issuing the POST without its body — sees a permanent failure and
  eventually stops, and the money still lands. The dashboard URL is typed by
  hand once, so `www` missing from it is a plausible, invisible, expensive typo.
  Fixed by exempting the webhook path from the redirect rule
  (`scripts/cf-waf-setup.mjs`), verified: apex POST now `401`/`200`, apex GET
  still `301`.
- **Nearly stopped at "the WAF exempts the path".** Reading the exemption is not
  the same as watching an empty-UA POST return `200` from a colo. The probe took
  ten minutes and is the only reason the apex problem was found at all.
- **`pnpm waf:apply` failed twice with `FAILED: fetch failed`** while `curl` to
  the same host worked. Node's fetch was resolving AAAA first and hanging;
  `NODE_OPTIONS=--dns-result-order=ipv4first pnpm waf:apply` ran clean. Same
  cause as `wrangler`'s "Unable to resolve Cloudflare's API hostname" a minute
  earlier — neither was a token, a permission or an outage.

## What worked

- Probing production with a throwaway email and deleting the row afterwards.
  A staging copy of this would have proved nothing about the live secret, the
  live WAF or the live redirect rule, which are three of the four things that
  can break it.
- Asserting on the database after every delivery rather than on the `200`. The
  endpoint answers `200` for everything it deliberately ignores, so the status
  code alone cannot tell "granted" from "not our level".

## Rules

- A money path is verified by firing it at production and reading the row, not
  by reading the handler.
- Any host-level redirect rule gets an exemption for machine-called paths.
  A 301 is not a 2xx, and senders are not browsers.
- Node fetch failing where `curl` succeeds on the same URL is a DNS-family
  problem: retry with `NODE_OPTIONS=--dns-result-order=ipv4first` before
  suspecting credentials.
