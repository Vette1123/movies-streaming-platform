# The fleet was ten strings, and we had blocked one of them

**Date:** 2026-09-01
**Area:** Cloudflare free plan — Worker invocation budget, WAF

## What

`pnpm cf:health` reported **91,355 invocations/day, 91% of the 100,000/day free
cap**, with kills at 0 and p99 CPU at 7.8ms. CPU was never the problem; the
request count was, and the site was one good launch day away from crossing it.
Past the cap the Worker stops and every `/api/*` route — search, infinite
scroll, season details, sync — dies while the static pages keep serving. Product
Hunt is scheduled for 8 Sep, so the failure would have landed on the one day
traffic actually arrives.

Where it went, from `pnpm cf:cpu 24`:

| route               | invocations/day | share |
| ------------------- | --------------- | ----- |
| `/movies/`          | 42,075          | 46.9% |
| `/api/media/`       | 25,579          | 28.5% |
| `/tv-shows/`        | 17,231          | 19.2% |
| `/api/season-details` | 3,332         | 3.7%  |

Grouping `httpRequestsAdaptiveGroups` by `userAgent` named the cause: **ten
frozen user-agent strings took 347,061 of 574,868 eyeball requests in 24h, 61%
of everything the zone served.** Chrome 118/119/120, Edge 119/120, Firefox
120/121 — all shipped in late 2023. Their daily counts sit within 6% of each
other (37,061 … 34,600), which is what a rotation over a fixed list looks like,
and the next stale non-fleet string underneath them is **825**. Nine of those
ten strings accounted for 25,152 of the 26,086 calls to `/api/media/`.

The fix was already written. `STALE_BROWSER_UAS` in `scripts/cf-waf-setup.mjs`
existed from the 31 Aug round and held exactly one string, guarded by a rule
scoped to detail paths. So: add the other nine, and lift the frozen-fingerprint
test out of `CHALLENGE_DETAIL_SCRAPERS_RULE` into its own
`CHALLENGE_FROZEN_UAS_RULE` scoped like `BLOCK_RULE` (every path except the
review paths, the calendar feed and static assets). Expected: ~45,000
invocations/day back, 91% → ~46%.

## Mistakes

- **Fixed one string when the measurement had only looked at one route.** The 31
  Aug round found the Firefox-121 fingerprint through Workers Logs, which only
  sees requests that reach the Worker, and wrote a rule scoped to the paths
  those logs showed. The same fleet's `/api/media/` calls — the shell's own
  payload fetch, one extra invocation per tail page it renders — were 28% of the
  budget and never appeared in that view. A rule scoped to where you happened to
  look is not scoped to the problem.
- **Nearly rebuilt the shell to inline the payload.** `/api/media/` being 28% of
  invocations reads like an architecture problem: inline the detail payload into
  the fallback HTML and the second request disappears. The comment at
  `cloudflare/worker.js:1083` says why not — that payload is 98KB for a movie,
  it was deliberately peeled out, and the summary path exists because of it.
  Reading the comment cost a minute; the rewrite would have cost an afternoon
  and shipped 98KB per tail page to a scraper fleet.
- **Reached for the $5 Workers Paid plan as the first answer.** It is a real
  option and it does remove the ceiling, but 61% of the traffic being one
  scraper fleet means the cheapest fix was never the plan — it was ten lines of
  data. Raise the ceiling after you know what is under it.
- **`api.cloudflare.com` is not reachable from the sandboxed shell** —
  `ENOTFOUND` / connect timeout, while `curl` to the site itself works fine.
  Every `cf:*` script needs the sandbox turned off for that call. It reads as a
  Cloudflare outage the first time.

## What worked

- Grading the fleet by the **shape of the distribution**, not by the strings.
  Ten counts within 6% of each other with an 825-request cliff underneath is
  unambiguous; no individual UA in that list would have been suspicious alone.
- **Exact full-string matching, not a version floor.** `Chrome/<130` would have
  swept up `Amzn-SearchBot/0.1) Chrome/119` and `Claude-SearchBot/1.0` (6,898
  requests/day of AI-search crawling worth keeping) and any genuine straggler.
  An exact match on a frozen fingerprint cannot.
- `managed_challenge`, consistent with every other rule in the file: a
  misclassified real client gets a puzzle, not a door.
- Leaving static assets exempt. They cost no invocations, so challenging them
  buys nothing and would break a directory's server-side icon fetch — the
  failure the 31 Aug round already diagnosed on AlternativeTo.

## Rules

- **A frozen fingerprint is a zone-wide problem, not a route problem.** Scope
  the rule to the traffic, not to the log that happened to reveal it.
- Find fleets in `httpRequestsAdaptiveGroups` grouped by `userAgent`, not in
  Workers Logs — the Worker only sees the requests that reach it, which is the
  minority of what a scraper costs you.
- Before treating an invocation count as an architecture problem, check the
  comment at the code that made it. `cloudflare/worker.js` explains its own
  request shape.
- Any `cf:*` script needs the shell sandbox disabled; `api.cloudflare.com` does
  not resolve inside it.
- The invocation cap is the free plan's binding constraint now, not CPU. Kills
  have been 0.0% since the static-export migration; `pnpm cf:health` grades
  invocations at 91% while every CPU line passes. Read that line first.

## Related

- `lessons/2026-08-31-marketing-round-two.md` — the round that added the first
  string to `STALE_BROWSER_UAS`.
- `lessons/2026-08-20-worker-cpu-by-route.md` — `pnpm cf:cpu`, the by-route view
  that made the `/api/media/` share visible.
