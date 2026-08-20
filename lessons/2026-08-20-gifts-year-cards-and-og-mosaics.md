# Gifts, year-scoped cards and real OG poster mosaics

**Date:** 2026-08-20
**Area:** `lib/billing/*`, `lib/library-search.ts`, `lib/stats*.ts`, `lib/og/mosaic.ts`, `cloudflare/worker.js`

## What

The last four supporter features of the batch:

- **Library search + bulk actions** — one folded substring pass over the sync stores, episodes collapsed into their series, selection acting on the title rather than the row. No endpoint: it rides out on the ordinary sync.
- **Gift a month** and **referral credit** — two ways a month of supporter moves between accounts, both landing in one `grantMonths` that EXTENDS rather than sets.
- **Seasonal card** — the existing "Get your card" scoped to a year by a pill row above the figures.
- **Open-graph poster mosaics** — a real 1200x630 composed card for `/l/<slug>` and `/u/<handle>`, drawn by the image CDN from the list's own posters.

The trial (feature 7 of the original twelve) was dropped on request before any of it shipped; `trial_started_at` came back out of migration 0005 before it reached production.

## Mistakes

- **Assumed a poster mosaic was not affordable, and nearly shipped a consolation prize.** The plan on the way in was to give up on the mosaic and improve the unfurl "honestly" with a 16:9 backdrop instead of a letterboxed poster, on the reasoning that workerd has no canvas and a WASM rasteriser does not fit in 10ms of CPU. Both of those are true and neither was the question. The site already proxies every image through ImageKit, and ImageKit composes layers **in the URL** — so the Worker builds a string and the CDN does the drawing, for zero CPU and zero subrequests. The feature was ruled out by reasoning about the runtime we would have had to write, not by reading the one we already pay for.
- **Two ImageKit syntax details cost most of the probing.** Multiple `l-image` blocks inside ONE transform silently render only the last one — layers have to be **chained with `:`** (`tr:base:layer:layer:text`). And `tw-` (the text layer's wrap width) is rejected outright with `Invalid Transformation`, which is why the card truncates its two lines by character count instead. `i-ik_canvas` (a solid colour overlay, for a scrim) is refused by this account too; the wallpaper is the first poster, padded and blurred, which turned out better anyway.
- **Wrote a centring test against arithmetic done in my head.** Two posters centre at `lx-400`, not `lx-290`. The code was right and the test was wrong — cheap here, but it is the failure mode where a wrong expectation gets "fixed" in the source.
- **Reached for `computeStats(…, year)` before checking what a year actually changes.** Nothing downstream needs to know a year exists: scoping is `inYear` over the two stores at the call site, and every figure is the same function over fewer rows. One exported filter instead of a parameter threaded through a signature everything else already calls.
- **Lost ten minutes to the account page rendering nothing under a stubbed session.** The stub answered `/api/account`; the store fetches `/api/auth/refresh` and settles `signedIn` from `data.success` + `data.token`. Until that lands the panel is `signedIn === undefined` and stays a skeleton — while the header still shows a name, because that comes from the localStorage profile cache. A signed-in-looking header is not evidence the session settled.

## What worked

- **Probing the CDN with `curl` before writing a line of the module.** Every question — do layers work at all, does chaining, does `tw-`, does `ik_canvas`, what does it weigh — was answered against the real host in about ten minutes, and the module was then written once against known-good syntax.
- **Validating poster paths against `/^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/` rather than escaping them.** These come out of a synced payload — whatever somebody PUT into their own account — and land inside a URL whose commas and colons are an instruction language. Dropping anything that is not a TMDB path is the only version of this that is obviously safe.
- **`grantMonths` written once, for both features.** A gift and a referral are the same transaction from two sides, and the property that matters — a second month ADDS to time already paid for — is one function with one test file rather than two implementations that agree until they do not.
- **Driving the whole card path in a real browser.** Stubbing `navigator.canShare` to false and capturing the blob through `URL.createObjectURL` produced the actual PNG: `MY 2026 ON REELY`, `Mohamed Gado's 2026`, `reely-2026.png`, and the figures scoped to 3 films / 6 hours / 1 show. The `await` chain means the blob appears a beat after the click — reading the capture in the same evaluation says "nothing happened".

## Rules

- Before ruling a feature out on runtime cost, check what the **services already in the stack** can do. The image CDN, the database and the cache each do work that would otherwise have to be written and then paid for per request.
- ImageKit layers chain with `:`. Anything after the first `l-end` in the same comma list is discarded silently.
- Text overlays cannot wrap on this account, so any text put on an image has to be cut to length in code.
- A year filter, a search, a scope — express it as a pure function over the input, not as a parameter on the thing that consumes the input.
- A stubbed session is settled by `/api/auth/refresh`, not `/api/account`. The header can look signed in while the panel is still waiting.
