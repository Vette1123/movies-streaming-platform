# Sitemap split: an index over three section files

## What

`/sitemap.xml` was one Next metadata route holding every URL. The ledger
(`data/sitemap-ledger.json`) only ever grows, and by 2026-11-14 the live file had
45,121 URLs. The daily Ratings job failed twice at `pnpm sitemap:ledger`, whose guard
fires at 80% of the 50,000-URL limit. `/sitemap.xml` is now a `<sitemapindex>` over
`/sitemaps/core.xml`, `/sitemaps/movies.xml` and `/sitemaps/tv.xml`. Each is a
`force-static` route handler whose XML comes from `lib/sitemap-xml.ts`, and the guard
counts each type against its own file. Built: core 1,092, movies 25,798 and tv 15,450
URLs, with 0 bare ampersands. Under workerd all four files return 200 with
`application/xml`.

## Mistakes

- **The Ratings job was red for two days before anyone noticed.** The guard did its job,
  but a failing scheduled workflow sends no alert anyone reads. The deploy workflow had
  `|| echo ::warning::` on the same step, so deploys stayed green and hid it.
- **The guard counted movie and TV together**, which made 44k look like a crisis.
  Split per type, the largest file is at 56% of its limit.
- **`expandSitemap` had to read the old flat file as well.** The first deploy after the
  split reads a live site that still serves one `<urlset>`. Without that, both the
  ledger and IndexNow would have seen an unreadable sitemap for one cycle.

## What worked

- Writing the XML by hand removed the escaping workaround. `renderUrlset` escapes every
  value, image URLs included, so the bare-`&` bug that once cost the site its Bing
  coverage cannot come back.
- The WAF needed no change, because `.xml` was already on the asset-extension allowlist.

## Rules

- A guard that fails the scheduled job also needs an owner who sees that job fail.
- Size a limit check by the unit the limit applies to (one file), not by the whole site.
