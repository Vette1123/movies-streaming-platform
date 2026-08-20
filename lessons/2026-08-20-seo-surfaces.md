# SEO: the data was already there, the pages were not

**Date:** 2026-08-20

## What

Six things a crawler could not previously see, all built from data the site
already fetched:

1. **VideoObject for the trailer**, nested under the title's `trailer` property.
2. **`actor` / `director` / `creator`** on Movie and TVSeries, from the credits
   block the cast rail already renders.
3. **ItemList** on the browse, genre, franchise, person and year pages.
4. **Sitemap honesty**: detail URLs lost their `lastModified` and gained their
   poster as an `<image:loc>` (2,040 of 2,390 URLs now carry one).
5. **A crawlable "where to watch"** block on every detail page.
6. **New indexable surface**: `/person/[id]` (196 pages) + `/people`,
   `/movies/year/[year]` and `/tv-shows/year/[year]` (37 each), and `/rss.xml`.

Measured: 2,127 → 2,402 routes, 12,903 → 14,513 files (73% of the 20,000 cap).
Zero new Worker routes, zero new client JavaScript, zero new TMDB requests on
any runtime path.

## Mistakes

**"Best movies of 2019" shipped Fight Club, The Matrix and Shawshank.** The
first version filtered with `release_date.gte`/`.lte`, which is what the browse
filters use. TMDB's date range matches ANY release record — a 2019 re-release or
digital drop qualifies a 1994 film. `primary_release_year` (and
`first_air_date_year` for TV) is the field that means what the page claims.
Caught only by looking at the built page; every test passed, and the page looked
perfectly plausible in the HTML.

**The obvious way to fetch watch providers would have cost Worker CPU.**
`append_to_response=watch/providers` on the detail call is free at build — but
`cloudflare/worker.js` serves `/api/media/*` from that *same* service function,
TMDB answers watch/providers for every country it knows (10-20KB), and that
route's CPU has already been an outage on this site. The fix was to make the two
callers fetch two different URLs, gated on `IS_PRERENDER` (the existing GOVERN
expression in fetch-client.ts, which is exactly "build or dev, never the
Worker"). The Worker's payload is byte-identical to what it was.

**Linking cast names to person pages nearly shipped 404s.** Only ~200 people are
prerendered; the cast of 2,100 titles is several thousand. Shipping the whole id
set to the client to decide would have put 1.4KB on every detail page. The page
resolves its OWN ten names on the server and passes down the handful that have a
page — a few dozen bytes.

**"Streaming on HBO Max Amazon Channel, YouTube TV and HBO Max."** TMDB lists
reseller add-ons next to the service itself. Reads like a bug, because it is
one; names ending in " Channel" are dropped now. Found in a screenshot, not a
test — the test I had asserted the shape, not that the sentence was sensible.

**IndexNow was already implemented.** It was on the plan as work to do. Reading
`scripts/cf-deploy.mjs` first would have saved proposing it: the deploy already
pulls the live sitemap and submits every URL on it, so the new pages were always
going to be pinged the moment they appeared in the sitemap.

**Three WAF rules quietly applied to the new routes.** `/movies/year/2019`
starts with `/movies/`, which is how the scraper challenge and the rate limit
identify a detail page — so the year hubs would have been challenged like
scraper traffic. The genre hubs already carry that exclusion; the year hubs
needed the same, plus `_headers` and the cache rule for `/people`, `/person/*`
and `/rss.xml`.

## What worked

- Deriving everything from payloads already being fetched. Trailer, cast,
  director, poster URLs and provider lists all existed in memory at build and
  were being thrown away.
- `IS_PRERENDER` as a general answer to "do this only where React runs". It was
  already there as `GOVERN`; naming and exporting it made a second use possible.
- Building once, at the end, to measure the file cap. It is the only way to know
  — and it is also what caught the year-filter bug.

## Rules

- A TMDB "date" filter is not a release year. Use `primary_release_year` /
  `first_air_date_year` when the page's claim is "released in <year>".
- Before adding to `append_to_response`, check whether the Worker parses that
  same payload. If it does, gate the addition on `IS_PRERENDER`.
- A new route under `/movies/` or `/tv-shows/` inherits the detail-page WAF
  rules. Exclude it, and add it to `public/_headers` + `CACHEABLE_PATHS`.
- An internal link to a bounded prerendered set has to be resolved against that
  set, on the server, per page.
- `lastmod` on a page that did not change is worse than no `lastmod`.
