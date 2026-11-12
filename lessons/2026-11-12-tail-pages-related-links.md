# Tail pages link to their neighbours

## What

Search Console: 14,677 Reely pages "Crawled - currently not indexed". A 1,000-URL
sample was 636 movies, 218 series, 71 collections, 63 apex redirects and 9 people;
824 of them were crawled in November. Live, a tail page (served by the Worker)
had 2 internal links in its HTML, both genre hubs. A prerendered page had 26.
So the ~13,900 tail ids could be reached from the sitemap and from nowhere else.

The summary fetch now appends `recommendations` (+13KB, still 20 results for an
obscure 2008 film). `slimSummary` cuts that to 8 `{id, title, year}` before the
Worker caches it, and the body prints them as "More like this" links.

Same day, #191: `/favicon.png`, `/icon/favicon.ico` and `/img/favicon.ico` were
404s in cf:health. They now 301 to `/favicon.ico` in `_redirects` and `next.config.mjs`.

## Mistakes

- The first idea was `recommendations,similar` to cover titles with no recommendations.
  Measured: recommendations alone came back full for every sampled title, and
  `similar` doubles the payload. Dropped.
- The seo-facts header still said "no append_to_response". It would have misled
  the next reader into thinking the cost was zero.

## What worked

- Comparing one sampled not-indexed URL against a baked one with curl. The link
  count (2 vs 26) named the gap faster than reading the code.
- Slimming before `cachedJson` stores the summary, so a cache hit still parses ~2KB.

## Rules

- A tail page needs outbound links to other titles, not just facts. A page nothing links to is a page Google crawls and shelves.
- Any `append_to_response` on the Worker path is projected down before it is cached.
- Verify after deploy: a tail id's HTML contains "More like this", and `pnpm cf:cpu` shows the detail route's CPU has not moved.
