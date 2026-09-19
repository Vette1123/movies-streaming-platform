# Search Console was reporting the past

Date: 2026-09-19
Area: `data/people.json`, `scripts/refresh-people.mjs`, production verification

## What

Search Console: 21k indexed, **67.5k not indexed** across twelve reasons. The
headline number was "Server error (5xx) — 15,951 pages", which reads like the
site is on fire.

It is not. Every large bucket is a record of a bug that has already been fixed,
sitting in the report until Google recrawls. Each one was checked against
production rather than reasoned about:

| Reason | Pages | Checked | Verdict |
|---|---|---|---|
| Server error (5xx) | 15,951 | 31 sampled URLs as Googlebot | all **200**, ~200ms. `cf:health`: 0 eyeball 5xx of 72,090 |
| Excluded by `noindex` | 12,188 | 15 sampled, headers + meta | all `index, follow`, no X-Robots-Tag |
| Discovered / crawled, not indexed | 18,496 | — | Google-side, no site action |
| Alternative page w/ proper canonical | 8,713 | — | benign by definition |
| Duplicate without user-selected canonical | 6,345 | 7 sampled | self-canonical, distinct titles + descriptions, 1.6–2.2k visible chars |
| Page with redirect | 4,292 | 998 examples grouped by host | **all** on apex `reely.space` — the apex→www 301, by design |
| Not found (404) | 1,096 | 1,000 examples grouped by prefix | 387 Freebase, 25 person, rest dead TMDB ids |
| Soft 404 | 88 | 15 sampled | 1,608–2,636 visible chars, facts block present |

The 5xx are almost certainly the invocation cap: before the scraper fleet was
blocked on 2026-09-01 the Worker ran at 91% of the free plan's 100k/day, and the
examples' last-crawl dates cluster at 31 Aug. Once the cap is hit everything
5xx, Googlebot included.

**The one actionable thing** was in the 404 bucket: 25 `/person/<id>` URLs.
`/person/[id]` is `dynamicParams = false` against a committed set, so an id
outside `data/people.json` is a hard 404 with no Worker fallback. One of the 25
was `4866792` — the worked example in `refresh-people.mjs`'s own docstring. All
25 unioned in (197 → 287 of a 300 cap), deployed, and all 25 now return 200 to
Googlebot from the edge cache.

## Mistakes

**`seo:verify` was accused of silently skipping its own check.** Its output
reads `PASS tail page is served from the shell — no data-fallback-seo marker —
pick a different TAIL_ID, this one got prerendered`, and that was taken as a
check that passed without running — which would have been a serious hole, since
it is the assertion standing between us and a noindex regression on 13,900 tail
pages. It is not a hole. `check(label, ok, detail)` prints its detail string on
pass as well as fail, the detail here is phrased only as a failure hint, and the
two assertions after it ("clipped, not display:none", "872 chars, facts=true")
can only pass against a real fallback. The tail id is in the `INDEXABLE` loop
too, so its robots value is asserted. Read the helper before calling its output
a bug.

**The Freebase 404s were nearly filed as our bug.** 387 of 1,000 404 examples
are `/m/<mid>` and `/en/<topic>` — Freebase paths. The obvious story was that
something in our JSON-LD emits them. Scanning production for every URL-bearing
value — `href`, `src`, canonical, `og:url`, and each `url`/`item`/`@id`/`sameAs`
in every JSON-LD block, across six page shapes — returned **zero** non-absolute
and zero Freebase URLs. They are not ours, and 404 is the right answer.

**Two probe runs were wasted on `getaddrinfo ENOTFOUND www.reely.spacec`.** Git
Bash rewrites a leading-slash argument into a Windows path, so `/movies/550`
arrived as `C:/Program Files/Git/movies/550` and `ORIGIN + path` parsed as host
`www.reely.spacec` port `/Program Files...`. The first guess was a stray
character in the origin string. Pass paths through PowerShell, or
`MSYS_NO_PATHCONV=1`.

## What worked

- **Probing production instead of trusting the report's age.** Every category
  was a sample of real URLs fetched with a Googlebot UA. That is what turned
  "15,951 server errors" into "zero, this is a recrawl backlog" in one command.
- **Grouping the 1,000 examples by path prefix.** Eyeballing a list of a
  thousand URLs finds nothing; `groups['/'+p.split('/')[1]]` immediately
  separated 387 Freebase paths from 25 person pages from the long tail.
- **Grouping the redirect bucket by HOST, not path.** All 998 were apex. One
  line of arithmetic retired 4,292 pages of "issue".
- **The repo's own scripts.** `cf:health` (0 of 72,090 eyeball 5xx, 0 blocked
  crawler requests) and `seo:verify` (27/27) answered more than the console did,
  and `people:refresh <ids…>` already existed for exactly this.

## Rules

- A Search Console bucket is a historical record, not a live signal. Fetch a
  sample of its URLs before changing any code; the fix is often already shipped
  and the only action left is to request validation.
- Group the examples before reading them. The shape of a thousand URLs is the
  finding; the URLs themselves are not.
- Before blaming your own markup for strange crawled URLs, scan what the site
  actually emits — every attribute AND every JSON-LD value, not just `href`.
- `/person/[id]` and anything else with `dynamicParams = false` must have its id
  set unioned from the 404 report periodically. The set is a promise to Google,
  and the report is the list of promises broken.
- On Windows, a leading-slash CLI argument through Git Bash is a Windows path by
  the time the program sees it.
