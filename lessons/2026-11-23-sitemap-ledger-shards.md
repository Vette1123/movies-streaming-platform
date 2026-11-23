# Sitemap ledger shards

## What

The daily Ratings job failed on 2026-11-22 and 2026-11-23. `pnpm sitemap:ledger --probe` exits 1 once a title type passes 80% of the 50,000 URLs one sitemap file may hold, and the movie ledger reached 41,688. The job commits both `data/sitemap-ledger.json` and `data/media-ratings.json`, so for two days neither grew: no new RT/Metacritic scores and no new titles kept in the sitemap.

`movies.xml` and `tv.xml` now hold only the titles today's lists reach (baked plus linked, about 7.5k and 6.3k). The ledger tail is cut into 20,000-id shards served by one `app/sitemaps/[shard]/route.ts` (`movies-ledger-1.xml`, `movies-ledger-2.xml`, `tv-ledger-1.xml` today), and the shard count grows by itself. The 80% exit is gone. `scripts/sitemap-linked.mjs` skips ledger ids, so no URL appears in two files.

The export was checked with a build: 6 files, 59,407 URLs, no duplicates, largest file 16,247. The 2,994 live URLs missing locally were all titles that CI's pre-build `sitemap:ledger` folds in.

## Mistakes

- The 80% guard did its job: it went off ahead of the hard limit. But it was a red CI job and nobody was watching. Each warning bought another hand split ("split that section in lib/sitemap-sections.ts"), and this was the second one in 8 days (the first was 2026-11-15). The fix was to make the split automatic, not to split one more time.
- Making the guard a hard exit in a job that also commits unrelated data (ratings) made a sitemap warning block a different feature.

## What worked

- Reading the failing job's log tail first: the cause was one line above `exit code 1`.
- Building once to prove the dynamic route handler under `output: 'export'` writes `out/sitemaps/<name>.xml`. The type checker can't show that.

## Rules

- A size limit that grows with data gets sharding, not a warning that asks for a hand split.
- A scheduled job that commits several outputs must not fail on a warning about only one of them.
