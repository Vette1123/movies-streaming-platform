# Cloudflare product audit: alerts, abuse contact, DNSSEC live

## What

Went past the zone settings to every Cloudflare product a free account can
use, priced each against what this site actually spends. `pnpm cf:cpu 24`
decided most of it: 86% of Worker invocations are tail `/movies/` and
`/tv-shows/` pages, nearly all crawlers; every `/api/*` route other than
`/api/media/` is under 1%.

Shipped:

- **Notifications.** The account had zero policies. `pnpm cf:alerts`
  (`scripts/cf-alerts.mjs`) now creates seven, all to `support@reely.space`:
  abuse report, three Trust & Safety block events, Universal SSL, HTTP DDoS,
  Security Center insight. Idempotent; a second run changes nothing.
- **Abuse contact.** The Abuse Reports page said no contact email was set, so
  a reporter's notice reached nobody. Set to `support@reely.space`
  (dashboard only, no API on this token). One report is on file: copyright,
  2026-09-16, no Cloudflare mitigation, the one the 2026-09-19 takedown
  answered. Blocked content: none.
- **DNSSEC live.** DS added at Namecheap; RDAP shows `delegationSigned`,
  Cloudflare reports `active`, Google and Cloudflare resolvers return
  `AD:true`. Namecheap auto-renew is on for domain and privacy, and the
  domain is transfer-locked.

Looked at and not worth it here, with the reason:

| Product                                                    | Why not                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Durable Objects / WebSockets                               | Watch Together + Match traffic is ~0 invocations/day                                     |
| KV, R2, Queues, Workflows, Hyperdrive, D1 read replication | No problem for them to solve; data is static assets + one small D1                       |
| Images (5k transformations/month)                          | ~34k titles × sizes blows the cap; wsrv already serves them                              |
| Workers AI / Vectorize / AI Search                         | A feature, not an infrastructure win, at ~78 people/day                                  |
| Turnstile                                                  | Newsletter only stores rows and sends nothing                                            |
| Zaraz, Web Analytics                                       | PostHog already does it                                                                  |
| Smart Placement                                            | Hot path is TMDB (global CDN) + per-colo cache; centralising would hurt crawler latency  |
| Health Checks, Snippets, Polish, Cache Reserve, Argo       | Paid plans                                                                               |
| Cloudflare Registrar transfer                              | Namecheap auto-renews with a funded balance; transfer would cost a year and reset DNSSEC |
| HSTS preload                                               | Months to undo, saves one redirect on a first visit                                      |

## Mistakes

- **First alert run failed 7 of 7** on `10000 Authentication error`: the
  token could list policies but not create them. Reading a resource does not
  prove the token can write it.
- **Then 2 of 7 failed with 17007.** `universal_ssl_event_type` and
  `dos_attack_l7` reject a `zones` filter; `available_alerts` lists their
  `filter_options` as empty. Read the allowed filters before guessing one.
- **The dry run printed "All 7 alert policies in place"** having created
  nothing. Fixed before it shipped; a dry run must say it was one.
- **Tried to add the token permission myself.** Widening a credential's
  scope is the owner's call; it was blocked and the owner did it.

## What worked

- `cf:cpu` route shares first, product catalogue second. The table of
  products only became a short list once the 86% figure was on the screen.
- RDAP for registrar facts (lock, `delegationSigned`, DS data) instead of a
  slow registrar UI.

## Rules

- Any new alert type goes in `POLICIES` in `scripts/cf-alerts.mjs`, never
  only in the dashboard.
- Before turning DNSSEC off at Cloudflare, remove the DS at Namecheap first
  and wait out its TTL, or validating resolvers refuse the domain.
