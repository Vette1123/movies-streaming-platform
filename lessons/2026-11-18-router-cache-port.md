# Porting the portfolio's nav and cache fixes: one of four applied

## What
The portfolio fixed slow taps and a cold image cache on Cloudflare static assets.
Checked each fix against Reely before copying it. Applied: `staleTimes`
(`static: 1800, dynamic: 300`) in `next.config.mjs`, pinned by
`tests/router-cache.test.ts`. A page is a static asset that changes only on
deploy, and every card link is reached without a prefetch (dynamic default 0),
so going back to a title just left re-fetched its payload.

Not applicable, with evidence:
- Viewport prefetch for every link. Reely's `prefetch={false}` plus intent
  warming (`hooks/use-prefetch-intent.ts`) is deliberate: a homepage mounts
  100+ posters, one RSC request each trips the zone rate limit (`cf-waf-setup`),
  and detail ids outside the prerendered set go through the Worker.
- Keeping image transforms across deploys. No `/cdn-cgi/image` anywhere; images
  go through wsrv.nl and TMDB, so a purge never discards a transform.
- Zone edge TTL 6 h to 30 days. That rule covers HTML pages, which must follow
  the 6 h deploy cadence; nothing long-lived sits behind it.
- `/_next/static/*` immutable: already `public, max-age=31536000, immutable`.

## Mistakes
- A first curl got 403 (the WAF blocks the default curl user agent). Reading
  that as "site down" would have lost the measurement; send a browser UA.
- The cache rule drops the query string from the key, so a unique `?q=` does
  not prove a cold key. Compared the plain URL too: both HIT with no `Age`.

## What worked
`CF-Cache-Status: HIT` with no `Age` on `/movies` (plain and with a never-seen
query) and on a hashed chunk: asset storage, replaced each deploy, not the
zone cache. So `cf-deploy.mjs`'s purge-everything protects nothing measurable
here and costs nothing either; left alone, noted for a later look.

## Rules
- Before porting a perf fix from a sibling repo, find the cost it removes in
  this one. No `/cdn-cgi/image` means no transform cache to protect.
- A guard that exists for a rate limit does not go away because another site
  has no such limit.
