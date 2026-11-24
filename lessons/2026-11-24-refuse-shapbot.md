# ShapBot refused: the day's 503s were one crawler outrunning TMDB

## What

cf:health warned on 19 eyeball 5xx of 141,904 (0.013%). Broken down by host/path/UA: 3 were
502s from the player's resolve, and 16 were 503s on tail detail pages. 13 of those 16 came from
`ShapBot/0.1.0`, Parallel Web Systems' crawler for a web-search API it sells to other people's
agents. It took 8,574 requests in 24h. The 503s are the Worker's deliberate answer when TMDB
backs off (`UpstreamUnavailable` → 503 + Retry-After, so Google retries instead of dropping).
ShapBot is now in `config/blocked-crawlers.json` `aiTraining`, which refuses it in robots.txt
and blocks it in the WAF (CI runs `waf:apply` on deploy).

## Mistakes

- Treated the 5xx line as "under the gate, fine" in the first pass of the sweep. The count
  was small, but one GraphQL query by UA showed a single crawler behind most of it.
- The first red run of the test compared new against new: the hook refused the command that
  saved the old file, the next command ran anyway, and both runs were green. Check that the
  mutation actually happened before trusting a red result.

## What worked

- `httpRequestsAdaptiveGroups` with `userAgent_like` for the crawler's volume. `clientAsn` and
  `clientASNDescription` are not available on the free plan.

## Rules

- When the 5xx line warns, group it by UA before writing it off. A crawler with no referral
  value and thousands of requests a day goes on the refusal list, with the numbers in the
  file's comment.
