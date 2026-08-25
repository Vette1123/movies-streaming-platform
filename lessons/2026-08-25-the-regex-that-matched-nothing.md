# The regex that matched nothing

**Date:** 2026-08-25

## What

Investigated "reely-pro-player, check errors there, also CPU time is fucked".

Two separate things turned out to be true, and only one of them was still
happening:

- **The errors were already fixed.** 84 `scriptThrewException` out of 533
  invocations in 24h looked alarming, but every one of them fell inside a single
  hour — `2026-08-24T07:00Z` — which is the window in which the `cached()`
  body-transfer fix (`657e5d8` in the player repo) was rolling out. The 296
  invocations after the `08:29Z` deploy threw zero. Nothing was broken at the
  time of the report.
- **The CPU was real.** `cpuTimeP50` 1.1ms -> 6.4ms and `cpuTimeP99` -> 29.1ms
  across the same deploy boundary, with subrequests per invocation going 1.4 ->
  4.6.

The root cause of the CPU was in THIS repo, not the player: the playback ticket
route guarded the IMDb id with

```js
if (typeof body.imdb === 'string' && /^ttd{5,12}$/.test(body.imdb)) {
```

`ttd{5,12}` is `tt` followed by five to twelve literal letter `d`s. A lost
backslash. No real IMDb id has ever matched it, so `im` was never appended to
the play URL, so the player's cheapest subtitle source (Stremio's addon — one
JSON call plus one UTF-8 `.srt`, and the only source addressable by the IMDb id
alone) was skipped on **every single request**, and every subtitle lookup fell
through to the three-catalog website walk instead.

Fixed by extracting the shape to `lib/imdb-id.ts` (`isImdbId`) — there were
already two other hand-written copies, in `lib/import/parse.ts` and
`lib/import/routes.ts` — and pointing all three at it.

## Mistakes

- **The first instinct was to read the player's code for the bug.** The symptom
  was in the player (slow, expensive subtitle walks) and the cause was one line
  in the caller that decided what the player was even told. Two hours of the
  player's source would never have found it; grepping for the id that was
  supposed to arrive did, in one command.
- **Nearly reported "84 errors, here is the fix".** The count is a
  window artifact. Bucketing the same query by hour — one extra `datetimeHour`
  dimension — showed all 84 in the hour of a rollout that had already ended.
  A raw 24h error count next to a deploy is not evidence of a live problem;
  the hourly shape is.
- **Spent several minutes hypothesising which line threw** (`cache.put`
  rejecting? unhandled rejection from the race? a CPU kill?) before checking
  whether it was still throwing at all. Wrong question first.
- **Chased a red herring in local dev:** podnapisi threw on every local
  request. It is a DNS failure on this machine (`curl` cannot resolve
  `podnapisi.net` either), not a production fault. Local failures of
  third-party hosts prove nothing about the edge.
- A dead regex is invisible: no test, no type error, no lint warning, no log
  line. Nothing anywhere says "this branch has never been taken".

## What worked

- `workersInvocationsAdaptive` grouped by `datetimeHour` AND `status` — the one
  query that separates "broken now" from "was broken during a rollout".
- Workers Logs (`observability/telemetry/query`) for the shape of one failing
  request: it carried the full URL, path, response status and `cpuTimeMs`,
  which is what identified the route. Note the retention here is short (~48h)
  — the exception had already aged out by the time the per-path query ran.
- Benchmarking the pure functions to size the problem before optimising:
  unzip 1.74ms + SRT->VTT 1.29ms per catalog, on a 90KB subtitle. Three
  catalogs is ~10ms of the 29ms p99, and that number is what made the fix
  obvious rather than speculative.
- Grepping for the value that should have arrived (`im`), instead of reading
  the code that was supposed to use it.

## Rules

- **When a caller decides what a service is told, read the caller first.** The
  service can only be as smart as its inputs.
- **Bucket error counts by hour before believing them.** A count over a window
  that contains a deploy is a count of the deploy.
- **A regex written three times is a regex that will be wrong once.** Extract on
  the second copy; the third is the one that silently matches nothing.
- **Test the validator, not just the thing it guards.** `isImdbId('tt0133093')`
  is a three-line test that would have caught this the day it was written.
- Local third-party failures (DNS, blocked hosts) are not production signal.
