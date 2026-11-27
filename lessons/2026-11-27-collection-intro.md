# Collection pages say what the franchise holds

## What

- Second sweep of 27 Nov: test 1411/1411, lint, typecheck, seo:verify 71/71, PostHog 0 open,
  GitHub 0 issues, CI green. cf:health: 0 kills of 49,240 invocations (49% of the cap), 1 eyeball
  500 in 134,202.
- `seo:pending` has 30 URLs crawled-not-indexed, and 24 of them are `/collection/<id>`. The page
  carried the name, TMDB's one-line overview, a count and a poster grid. `lib/collection-intro.ts`
  now writes the span, the first and latest film, and the best rated (at least 50 votes, two
  rated parts) out of the parts the page already renders, with no extra TMDB request. It sits above
  the grid, because the banner is a fixed 28rem and a long overview plus the intro would push
  the h1 under the nav. Verified in the dev server's HTML: Star Wars reads "spans 9 movies
  released from 1977 to 2019 … The Empire Strikes Back at 8.4/10".
- Bing: the 26 Nov crawl reported 43 5xx and 17 timeouts. Cloudflare's edge logged 5,623
  bingbot requests that day with 0 5xx (5,514 200, 82 301, 27 404). `seo:daily` already gates
  Bing by a jump over its own week (`scripts/lib/search-engines.mjs`), and it ran green.
- Request Indexing rolls again: the account quota was spent earlier today.

## Mistakes

- Both sweep agents reported "no Bing script" because none is named `*bing*`; the check lives
  inside `seo:daily`. I nearly ported portfolio-v1's `check:bing`, whose zero baseline for
  Code5xx would have been red every day here (Reely's sits near 40, none of it at our edge).

## What worked

- Grouping the crawled-not-indexed list by route before writing content: 24 of 30 were one
  template.

## Rules

- Before adding a check, grep for the API it calls (`GetCrawlStats`), not for a script name.
- A collection or genre page earns its index slot with text derived from what it lists.
