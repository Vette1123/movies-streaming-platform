# GSC and Bing audit, 2026-11-21

## What

- GSC (sc-domain:reely.space), 28 days vs the previous 28: clicks 73 vs 45, impressions 2,860 vs 548. No page-one URL under 1% CTR with 100+ impressions.
- Sitemap index read 2026-11-21, but Google had only read `core.xml` and `movies.xml`; `tv.xml`
  (18,471 URLs, added in #205) was never fetched. Submitted it directly through the Sitemaps API.
- Page indexing, 77.8k not indexed. Sampled before touching code:
  - 5xx (5,412): newest example crawled 3 Aug; validation running. Backlog.
  - 404 (830): examples from Nov 16-17 are titles TMDB itself 404s (deleted upstream) and none are
    in our sitemaps. Correct answer, nothing to fix.
  - noindex (3,565): recent examples are `/kodi`, `/stats`, `/account`, all deliberate in source;
    media pages last seen 5 Sep (the fixed hydration bug).
- Bing: no crawl issues and no blocked URLs; 106,860 in index and rising.

## Mistakes

- An audit subagent proposed pointing `seo:verify` at `www`. The script expects the apex and adds
  `www.` for the canonical itself, so the proposal would have broken it. Its failures were the WAF
  challenging this machine's IP, not crawlers.
- The API reported 74,908 sitemap "warnings"; the console shows none. Not a lead.

## What worked

- One sample per bucket (date of newest example, then TMDB for 404 ids) settled each in minutes.

## Rules

- After splitting a sitemap, check that GSC lists every child; submit a missing child directly.
- A 404 for a TMDB-deleted id is the right permanent answer; only a sitemap entry for it is a bug.
