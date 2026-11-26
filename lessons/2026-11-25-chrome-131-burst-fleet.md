# The Chrome/131.0 burst fleet behind the 503 hours

## What

`cf:health` failed on 80 eyeball 5xx in 24 h, 41 of them at 2026-11-24 21:00 UTC and most of
the rest at 25 Nov 05:00. Both hours were title pages and `/api/media` answering the designed
TMDB-outage 503 + Retry-After, with Googlebot, Applebot and Bingbot among those served one.
Grouping `httpRequestsAdaptiveGroups` by `userAgent` for those hours put one string on top
(2,637 and 1,864 an hour): `… Chrome/131.0 Safari/537.36`, 20,821 requests on 24 Nov, #2 in the
zone. It is absent from the quiet hours (10, 15, 23 UTC). Added to `STALE_BROWSER_UAS`
(exact-match block), applied with `pnpm waf:apply`; live: the string gets a plain 403, a
Chrome 154 still gets 200 on `/movies`.

## Mistakes

- Grouped all 5xx first: the top rows were Worker subrequest 504s with an Unknown UA, not
  visitors. `requestSource: "eyeball"` is the filter `cf:health` itself counts; start there.
- My first live check sent bare curl and read the Chrome 154 403 as the new rule misfiring.
  It was the existing detail-page challenge (`cf-mitigated: challenge`); a block has no such header.

## What worked

- A burst-hour vs quiet-hour comparison of the top UAs names a fleet in two queries.
- The malformed version (`131.0`, two parts) is proof on its own: a reduced-UA Chrome always
  sends `131.0.0.0`, so the exact match cannot catch a person.

## Rules

- A 5xx burst on the 503-by-design path is a load question: find who drove the load.
- Tell a block from a challenge by `cf-mitigated`, not by the status code.
