# Router cache to the rebuild cadence, first-row prefetch

## What

- `staleTimes` static and dynamic raised to 18000 s (5 h). The deploy cron fires every 6 h (`0 0/6/12/18 * * *`), so 5 h is the longest value that stays under it. Pinned in `tests/router-cache.test.ts`.
- `MediaLink` / `Card` take `eager`; the first 6 cards of a rail (`EAGER_PREFETCH_CARDS`) use Next's default viewport prefetch, the rest keep intent warming. Pinned in `tests/eager-prefetch.test.ts`.
- Measured and left alone: wsrv images already ship `Cache-Control: public, max-age=31536000` (HIT on the second request), TMDB direct 369 days; the page cache rule gives MISS then HIT with `s-maxage=21600`; HTML is brotli, `alt-svc: h3` is on, `/_next/static` is immutable; `preconnect` wsrv and `dns-prefetch` TMDB, `fetchPriority=high` preload on the hero only, already in place.

## Mistakes

- `reely.site` is not ours (it answers with another site's headers). The zone is `reely.space`; the first probes hit the wrong host.
- The earlier "no Age header" reading was not evidence about the zone cache: the rule drops the query string from the key. A never-requested path shows MISS then HIT, so the cache works; there is simply no `Age` header on a HIT here.
- Baseline before the change: 54 `__next.*.txt` prefetches on a cold homepage load (27 for detail routes), already from hero and nav links.

## What worked

- Counting `performance.getEntriesByType('resource')` for `__next.*.txt` in a real tab gives the prefetch count in seconds.
- A pure `mediaLinkPrefetch(eager)` helper makes the prefetch prop testable without rendering.

## Rules

- Staleness caps (`staleTimes`) track the deploy cron in `deploy.yml`; change both together.
- Viewport prefetch only for a bounded first row; the zone rate limit (300 req/10 s per IP on detail paths) is the budget.
