# The Worker's CPU, measured per route instead of guessed

**Date:** 2026-08-20
**Area:** `scripts/cf-cpu.mjs`, `services/season-details.ts`, `services/watch-providers.ts`, `lib/credits.ts`, `lib/api/account-paths.ts`, `cloudflare/worker.js`

## What

The ask was "reduce CPU so we never hit a limit". `pnpm cf:health` could only say the script-wide distribution — p50 1.74ms, p99 6ms, 0 kills — which is the number that decides whether the site stays up and says nothing about where the time goes. Cloudflare's GraphQL analytics has no path dimension for it.

`observability.enabled` in `wrangler.jsonc` turns out to store `$workers.cpuTimeMs` alongside the request URL for every invocation, and the Workers Logs query API will group on it. `pnpm cf:cpu [hours]` is that query. The first run, over six hours of real traffic:

| route                        | n     | share | avg    | max      |
| ---------------------------- | ----- | ----- | ------ | -------- |
| `/movies/` (tail fallback)   | 7,553 | 57.9% | 1.65ms | 9ms      |
| `/tv-shows/` (tail fallback) | 4,972 | 38.1% | 1.81ms | 13ms     |
| `/api/season-details`        | 103   | 0.8%  | 3.23ms | **19ms** |
| `/api/media/`                | 65    | 0.5%  | 3.66ms | 7ms      |
| `/api/watch-providers`       | 19    | 0.1%  | 4.58ms | 6ms      |

Four fixes, all of them "stop carrying what nothing reads":

- **`/api/season-details`: 97 KB → 5.6 KB.** TMDB attaches `crew` and `guest_stars` to every episode. `guest_stars` appeared in exactly one place on the site — the type. That is 95% of the payload, parsed, re-serialized, cloned into `caches.default` and sent, per season.
- **`/api/watch-providers`: 84 KB → 37 KB.** Every one of the 292 providers carries `display_priorities`, a per-country priority map. The `WatchProvider` interface always said four fields; only the runtime object disagreed.
- **`/api/media/*`: 88,962 B → 20,499 B** (measured against production on `/movies/550`). The credits append is 71 KB of TMDB's 100 KB, 50 KB of it a 188-person crew of which the pages read one job (`Director`), and a 76-person cast of which both readers take ten.
- **Cold isolates stopped evaluating the account half.** `ownsPath` moved to a zero-import module (`lib/api/account-paths.ts`) so the router — seventeen route modules: auth, billing, push, sync, calendar — loads behind a dynamic `import()`. 96% of this Worker's traffic never touches any of it.

Plus the cache keys: `/api/*` answers are now keyed on the values the route actually used, not the raw request URL.

## Mistakes

- **Started optimising before measuring, and the first three candidates were all wrong.** The plan was cold-start bundle size (92 KB of code — a rounding error), pass-through streaming for `/api/filter` (impossible, the services transform), and the double JSON round-trip in the fallback path (1.7 KB, already made cheap by an earlier fix). The one route actually running at 19ms was not on the list. Ten minutes on the observability API replaced the whole plan.
- **Wrote a claim into a comment and only then checked it.** `trimCredits` was documented as also shrinking "every prerendered detail page's flight data". It does not: both detail pages render credits in server components, so those people never reached a browser from there. Measured by stashing the change and re-fetching the same page — byte-for-byte identical. The comment was rewritten to say what is true, which is the narrower `/api/media/*` win.
- **The allowlist that was supposed to close the cache-key hole only closed half of it.** `FILTER_PARAMS` stops junk query parameters reaching TMDB, and its own comment says they "became part of the Cache API key" — in the past tense. They still were: `cached()` keys on `request.url`, so `?with_genres=28&x=1`, `&x=2`, `&x=3` remained three misses of one result. A fix is not done because the comment says it is.
- **Shipped the commit message with an estimate in it instead of a measurement.** It claims `/api/media/*` went from "~28KB to ~7KB". The 28 KB came from an existing comment in `services/movies.ts` and is simply wrong for a film with a full crew; the real before/after, curled from production once the deploy landed, is 88,962 → 20,499 bytes. Both halves of the estimate were off, in opposite directions, and the true number is the better story. Measure first, then write the number down.
- **Trusted a two-second HMR window for a before/after measurement.** The stash/pop comparison was run against a Turbopack dev server that had had two seconds to recompile. The number happened to be right, but nothing in the method guaranteed it — that is how the ledger's earlier "believed the browser over the build" entry started.

## What worked

- **`$workers.cpuTimeMs` grouped by URL.** The dashboard cannot answer "which route is expensive"; the logs dataset can, and it was already being collected. Kept as `pnpm cf:cpu` rather than thrown away, sorted by total CPU (avg × n) so it names what to fix first rather than what looks worst.
- **Sizing the payloads with `curl` before writing any code.** Three requests gave the exact byte counts — 97,240 / 83,850 / 100,758 — and the trimmed sizes came from a five-line script over the same files. Every claim in the comments is a measured number.
- **The type was already right in two of the three cases.** `WatchProvider` declared four fields and `EpisodeDetails`' `guest_stars` had no reader. The fix was making the runtime object match what the code had been promising.
- **esbuild's lazy module init, asserted rather than assumed.** A module reached only through `import()` gets wrapped in `__esm` and initialised on first use. Confirmed by building an unminified bundle and grepping for the call site: `init_account_router()` appears once, inside the request handler.

## Rules

- Before optimising a Worker, run `pnpm cf:cpu`. Volume and cost are different axes and neither is where intuition puts it — 96% of traffic on the cheapest route, the worst route at 0.8%.
- When a payload is expensive, ask what reads it before asking how to make it faster. Three of the four fixes here were deletions.
- A comment claiming a fix is in place is not the fix. Check the key, the call, the byte count.
- Measure a before/after against a build you know is current — a stash and a two-second wait is not one.

---

## Follow-up, same day: the second round found nothing, and that is the result

Asked to take CPU down further. The remaining picture, measured over eight hours:

- The tail-id fallback is 96% of invocations and its **warm floor is 1.36ms** — 2,814 requests in the two colos that carry the traffic.
- The same route costs **2.8–3.5ms in colos that saw fewer than a hundred requests**, where nearly every request starts a cold isolate. That gap is `pnpm cf:cpu`'s new by-colo section: there is no cold-start flag in the dataset, but colo volume is a good proxy for one.
- Wall time on that route averages ~140ms against ~1.4ms of CPU, so it is a TMDB round trip with a small amount of string work stapled to it. Crawlers walk unique ids, so the summary cache almost never hits.

That pointed at isolate startup, so I built the change: every `@/services/*` import moved inside the `cached()` compute callback that uses it, and the four pre-split shells given one esbuild define each instead of a single 359 KB object at module scope — so a cold isolate would evaluate only what a fallback page needs.

**Then I measured it, and it does nothing.** Evaluating the bundle in node, seven runs each, before 13.47–14.73ms and after 13.81–14.90ms. Repeated with `NODE_COMPILE_CACHE` warm — which is the shape of what Workers actually pays, since Cloudflare compiles a script once per deploy and caches the code — before 8.65–8.95ms, after 9.23–9.79ms. The lazy version is if anything a hair slower. The 6ms that stripping the shells appeared to save in the first measurement was **parse**, not evaluation, and parse is paid once per deploy rather than once per isolate.

So the change was reverted. What shipped from this round is the by-colo breakdown in `pnpm cf:cpu`, and the knowledge that the tail path's 1.36ms warm floor is not module-init.

### Mistakes

- **Measured a proxy and believed it for an hour.** "12.5ms with the shells inlined, 6.5ms without" was a real measurement of the wrong quantity. It only became obvious when the A/B — same source size, different evaluation — showed nothing. A before/after that changes two variables (source size AND evaluation) cannot attribute the difference to either.
- **Wrote the whole change before testing the hypothesis it rested on.** Thirteen dynamic imports and a new build contract, then the measurement. The measurement is four lines and could have come first.
- **Nearly kept it anyway** on the grounds that it is "directionally right". It is more code, a second place shells can silently stop being inlined, and no measured gain — three good reasons not to have it.

### Rules

- A cold-start theory needs a measurement that isolates evaluation from parse. `NODE_COMPILE_CACHE` is the cheap way to do it; without it, node's import time is mostly parse and will mislead.
- Build the four-line experiment before the hundred-line change.
- "No measurable improvement" is a complete answer. Revert and say so.
