# A transient TMDB failure is not a 404

## What

Two `out/collection/*.html` pages shipped as "Page Not Found" noindex shells because a TMDB read failed once at build. Every detail page (movie, tv, collection, person) did `try { fetch } catch { notFound() }`, so a 429 that outlasted the retries, a 5xx or a dropped socket all meant "no such id". `lib/not-found.ts` (`notFoundOrThrow`) now calls `notFound()` only for a TMDB 404 and rethrows anything else, which fails the build loudly. `lib/fetch-client.ts` retries TMDB 500/502/503/504 (3 times, 0.5s steps) before giving up. In `cloudflare/worker.js`, `loadDetails`/`loadSummary`/`loadCollection` returned null for every error; `lib/upstream.ts` (`nullIfNotFound`) keeps null for a TMDB 404 only, and any other failure becomes `UpstreamUnavailable`, which the top-level catch answers with 503 + `Retry-After: 120` (Google retries a 503, drops a 404). Test: `tests/transient-not-404.test.ts`.

Chosen over "exclude the id from generateStaticParams": the id is only known to be unreachable after the page runs, and the Worker fallback covers ids outside the set anyway, so failing the build (a retry of the 4x/day build) is cheaper than silently losing a prerendered page. The same swallow existed in all four route kinds; all are fixed through the one helper.

Player server health (no code change): the `reely` source's 12 failures are 5 people, all `unavailable`/`stall`; 9 of 10 `unavailable` are two viewers retrying the same titles on 10-31 and 11-01, i.e. the player's own dead-on-boot report for titles its resolver could not stream, in a sample of 22 events. The percentage is small-sample noise on the supporter source. The real gap is `vidsrc.to` (26 failures against 71+59 plays, ~17%) versus `vidsrc.sh` (19 against 197, ~9%); branch `fix/default-server-slot-1` (d5c1a7f, unmerged, in the `posthog-fixes` worktree) already moves the default to Server 1 on the same evidence. `pnpm embed:probe` is a manual sandbox-screening page, not a health check, and cannot say whether a title streams.

Never-fired events: all 17 have a live call site in a mounted component or hook. Over 90 days `filters_cleared` (36), `media_shared` (10) and `watchlist_removed` (9) did fire, last on 10-18 to 10-20; the rest were added 10-24 or are account actions that are rare at ~70 weekly users. Nothing broken, nothing changed.

## Mistakes

- The previous pass logged the baked shells as "not fixed here" and moved on; the cause was one `catch { notFound() }` pattern copied four times.
- First read of the player failures used `properties.source` for plays too and showed zero plays: `media_played` records `stream_source`. posthog-usage already coalesces both; ad-hoc queries must too.
- Assumed `pnpm embed:probe` was a health probe. It opens a browser comparison page and waits for a person; it hung until stopped.
- `analytics-coverage` passes when a track helper is merely referenced somewhere. It cannot see an event wired into a component nothing mounts, so "never fired" has to be checked by hand against mounts.

## What worked

Grepping `notFound()` across app/ showed the whole class in one pass. Making the test red by zeroing the retry constant and by restoring the old worker proved both halves bite.

## Rules

- A `catch` that answers "not found" must test for a 404 status; every other failure rethrows.
- For crawlers a transient failure is a 503 with Retry-After, never a 404.
- Ad-hoc PostHog queries on plays read `coalesce(source, stream_source)`.
