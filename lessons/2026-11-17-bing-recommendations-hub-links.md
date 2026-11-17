# Bing recommendations: the hubs linked titles no sitemap listed (2026-11-17)

## What

Bing Webmaster Tools "Recommendations" for www.reely.space had four rows. Checked each against production:

| Row                                     | Bing count | Live state                                 | Action                                             |
| --------------------------------------- | ---------- | ------------------------------------------ | -------------------------------------------------- |
| Important pages missing in sitemaps     | 11         | 6 already listed (ledger); 5 truly missing | Fixed at the cause, plus the 5 added to the ledger |
| Meta descriptions too short             | 82         | All 25 sampled are 150-159 decoded chars   | None: scan predates the 150 floor                  |
| Meta robots noindex                     | 2          | `/account`, `/watchlist`                   | None: per-user pages, noindex intended             |
| Inbound links from high-quality domains | -          | Off-page                                   | Not a code fix                                     |

The cause of the missing pages: `lib/sitemap-sections.ts` lists the baked titles and their detail rails, but not what the person, franchise, genre and year hubs link to. Those 1,091 hub pages linked 3,638 titles no sitemap listed (person pages alone carried 4,084 of the links). `scripts/sitemap-linked.mjs` now runs after `next build` in `build:cf`, reads every exported HTML file, and appends each linked title missing from `out/sitemaps/{movies,tv}.xml`, skipping the ledger's `gone` and taken-down titles. Measured on a mirror of the live hubs: +2,940 movies (34,052 URLs, 68% of the per-file cap), +698 TV (17,304).

## Mistakes

- Read Bing's list as "the sitemap has gaps today". Six of the eleven were already listed; Bing reports from its last scan. Checking each URL against the live sitemap first split stale from real.
- First idea was a hub-by-hub fetcher in `sitemap-sections.ts`, the way the rails were done. That is four more copies of each page's slicing logic that can drift from what the page renders. Reading the exported HTML gives the sitemap exactly what the pages link to.

## What worked

- Verifying the build step without a build: mirror the live sitemaps and hub pages into a scratch `out/`, run the step, compare its count to an independent scan (3,638 both).
- `pnpm seo:verify` now checks a person, franchise, genre and year page as well as a detail page; it failed on production (2 and 7 missing) before this shipped.

## Rules

- Every title a baked page links to goes in the sitemap. Derive it from the exported HTML, not from a parallel list.
- Before acting on a Bing or Search Console row, test its URLs against production. The report is a past scan.
