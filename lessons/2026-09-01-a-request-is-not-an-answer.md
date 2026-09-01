# A request is not an answer, and a hub that never changes never gets crawled

**Date:** 2026-09-01
**Area:** Cloudflare WAF / crawl budget, organic search

## What

Second half of the same day as `2026-09-01-the-fleet-was-ten-strings.md`. That
round added ten frozen user-agent strings to a `managed_challenge` rule and
called it done. It was not done.

Forty minutes after the rule went live, the ten strings were still taking ~400
requests against `/movies/*`. A managed challenge issues a `cf_clearance` cookie
good for 30 minutes and whatever is behind those strings runs enough of a
browser to solve it — so the challenge was not a filter, it was a toll booth the
scraper was happy to pay. Escalated to `block`.

Then the same shape turned up twice more:

- **`Amzn-SearchBot` had been disallowed in `robots.txt` since 31 Aug** and was
  still crawling ~4,100 requests/day 24 hours later. Amazon documents that its
  crawlers ignore `Crawl-delay`, and this one evidently ignores `Disallow` on
  any timescale that matters.
- **The refuse-list lived in two hand-written places.** `app/robots.ts` had its
  Disallow groups; `scripts/cf-waf-setup.mjs` had one token. Nothing kept them
  in step, and the gap between them is exactly where Amzn-SearchBot sat.

`config/blocked-crawlers.json` is now the single list. `robots.ts` builds its
groups from it, `cf-waf-setup.mjs` blocks the union — above `ALLOW_RULE`, which
skips the whole `waf` product for anything `cf.client.bot` verifies, and
Cloudflare verifies both Amazon's and Yandex's crawlers.

Newly refused, each on a measured number: **YandexBot** at ~11,000 requests/day,
11% of the entire free-plan invocation cap, against an English-language
catalogue, with no `Crawl-delay` support since 2018; **Baiduspider** on the same
mismatch; the SEO-tool and AI-training groups, which were already refused in
`robots.txt` and are now enforced. **Applebot keeps its access and gets a rate**
— the named-crawler group carries `Crawl-delay: 20`, capping a compliant crawler
at 4,320/day against the ~7,800 Applebot was taking. Google has never supported
the directive and is deliberately the one crawler left unthrottled.

Then the SEO half. `pnpm seo:verify` was 27/27 and a live tail page checked out
post-hydration (`index, follow`, self-canonical, three JSON-LD blocks, the new
title format), so the mechanical work was already right. Search Console said
what was actually wrong: **43,781 pages sitting in states a recrawl would
clear** — 15,989 "Server error (5xx)" dated to the 3 Aug migration, 11,464
"Excluded by 'noindex'" and 6,923 "Duplicate without user-selected canonical"
from the fallback-shell bug, 9,405 "Crawled - currently not indexed". Every one
of those fixed in the code, every one waiting on a crawler.

And the sitemap was telling that crawler not to come: **every browse hub carried
`lastmod: 2024-01-01`** — homepage, `/movies`, `/tv-shows`, `/lists`, `/people`,
all 32 genre hubs, every year hub. Their rows are trending and popular lists
that turn over on every deploy. They now carry the build timestamp.

Also shipped: the two detail-page rails were headed "Similar Movies" and
"Recommended Movies" — the same boilerplate on ~13,000 URLs. They now read
"Movies like Fight Club" and "If you liked Fight Club", which is a query with
volume that IMDb does not own the way it owns the bare title, off data the page
already fetched.

## Mistakes

- **Shipped a challenge where a block was needed, and did not re-measure for 40
  minutes.** The rule was verified as "fleet UA gets 403 on `/movies/<id>`" —
  one curl, from a client with no cookie jar. The check that mattered was the
  one that came later: are the invocations actually falling? They were not. A
  single-request probe cannot see a client that solves a challenge once and then
  walks through for half an hour.
- **Read a 24-hour health window against a rule that was 26 minutes old** and
  briefly believed the fix had done nothing. `pnpm cf:health 1` was the right
  call and it was the second one made, not the first. Any window that spans a
  deploy is mostly the world before it.
- **Wrote the WAF token list by hand when robots.ts already had one.** The DRY
  rule is not decoration here: the two lists had already drifted, and the drift
  was the bug. It cost ~4,100 invocations/day for a day.
- **Assumed the invocation budget was still a scraper problem after the fleet
  was blocked.** It was not — the remaining `/movies/*` load was 63% verified
  search and AI crawlers (Yandex 304, Applebot 218, Amzn 115, bingbot 53 per 40
  minutes). Blocking harder would have started costing indexing. Grouping the
  tail-page hits by user-agent, rather than the zone as a whole, is what made
  that visible.
- **Nearly filed the three "Validation failed" rows in Search Console as bugs.**
  "Page with redirect" (2,272) is apex URLs answering 301 to www, which is
  correct. "Not found (404)" (1,261) is mostly `/m/<freebase-id>` and
  `/tv-shows/64092/tv-shows/64092` — URLs this site never emitted; grepping for
  a relative `href` found nothing because there is none. A 404 is the right
  answer and GSC's "failed" only means the URL still does what it should.

## What worked

- **Grading the fix by the number it was supposed to move**, not by whether the
  rule existed. The rule existed and was live and correct, and the traffic was
  unchanged.
- Separating "who is hitting tail pages" from "who is hitting the zone".
  `clientRequestPath_like: "/movies/%"` grouped by `userAgent` is the query;
  without the path filter the answer is dominated by static assets, which cost
  nothing.
- Keeping a rate for Applebot instead of a refusal. It honours `Crawl-delay`, so
  there was a middle setting; Yandex and Amazon have none, which is what made
  those all-or-nothing.
- Checking a real production tail page in a browser _after hydration_ rather
  than trusting `seo:verify`, which reads the served HTML. The 11,464 noindex
  pages came from a bug that only existed after React re-rendered the head.
- Removing YandexBot and PetalBot from `cf-health`'s graded crawler set in the
  same commit that blocked them. A check that fails on a refusal the operator
  chose is a check that gets ignored.

## Rules

- **A `managed_challenge` is a filter only against a client that cannot solve
  it.** Anything running a real browser engine solves it and gets 30 minutes of
  clearance. For a fingerprint you are confident about, block.
- **Verify a WAF rule with the metric, not with a curl.** One request proves the
  expression matches; only the invocation count proves the traffic stopped.
- **robots.txt is a request. The WAF is the answer.** Anything you actually need
  refused belongs in both, from one list — `config/blocked-crawlers.json`.
- A block rule for a crawler Cloudflare verifies must sit **above** `ALLOW_RULE`,
  which skips the whole `waf` product for `cf.client.bot`.
- **`lastmod` is a crawl-budget instrument.** A hub whose content turns over
  every deploy must say so; a detail page that has not changed in years must say
  nothing. The failure mode is symmetric and the second one is documented in
  `app/sitemap.ts` — putting a build timestamp on 2,100 unchanged detail pages
  makes Google distrust the field everywhere.
- Before treating a Search Console "Validation failed" as a defect, check what
  the URL actually returns. 301 to the canonical host and 404 for a URL that
  never existed are both correct answers that GSC files under failure.

## Related

- `lessons/2026-09-01-the-fleet-was-ten-strings.md` — the morning's round, and
  the challenge this one had to escalate.
- `lessons/2026-09-01-the-clicks-were-all-brand.md` — the `<title>` split that
  the rail headings extend.
- `config/blocked-crawlers.json` — the list, and why each group is on it.
