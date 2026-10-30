# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Reely** — a TMDB-powered movie/TV discovery, tracking, and streaming app. Next.js 16 (App Router, RSC, Turbopack) + React 19 + TypeScript 7 + Tailwind 4. Shipped as a **static export (`output: 'export'`) on Cloudflare Workers Static Assets**, with one hand-written Worker for the parts that cannot be static — most non-obvious constraints in this codebase exist to stay inside the Cloudflare **free plan** limits.

## Commands

```bash
pnpm dev                # dev server (Turbopack) — http://localhost:3000
pnpm lint               # ESLint 10 (its typescript-eslint runs on TS 6 — see .pnpmfile.cjs)
pnpm typecheck          # tsc --noEmit on TypeScript 7 (native)
pnpm prettier:check     # verify formatting; prettier:format to write
pnpm build              # next build (rarely needed locally — see below)

# Cloudflare (static export + Worker)
pnpm build:cf           # static export to out/ + bundle .cloudflare/worker.mjs
pnpm preview            # build:cf + wrangler dev (real workerd runtime)
pnpm deploy             # deploy via scripts/cf-deploy.mjs (needs CLOUDFLARE_API_TOKEN)
pnpm deploy:full        # build:cf + deploy

# One-off asset/data builds
pnpm imdb:ratings       # regenerate public/imdb-ratings/*.json shards
pnpm og:build           # regenerate the static OG image
pnpm waf:apply          # push Cloudflare WAF + CDN cache rules
pnpm bmc:probe          # end-to-end check of the live payment webhook (writes + deletes one throwaway row)
pnpm share:probe       # a real list and profile unfurled through D1, the Worker and wsrv (writes + deletes one throwaway user)
pnpm resume:probe       # resume + playback prefs through the real page AND real player (pnpm dev + `pnpm harness` in ../reely-pro-player)
pnpm cf:cpu [hours]     # production Worker CPU broken down BY ROUTE (Workers Logs); cf:health has the kills
pnpm lighthouse         # medians with timing; run the Lighthouse workflow instead, a home connection measures itself
```

- **Package manager is pnpm 12** (`packageManager` pin). Do not use npm/yarn. `minimumReleaseAge: 0` in `pnpm-workspace.yaml` is deliberate: the project takes every release the day it ships, and pnpm's default 1-day quarantine would hold upgrades back and fail CI's frozen install. Every dependency with an install script must be listed under `allowBuilds`, or the install errors.
- **The toolchain tracks labels, not versions**: CI runs on `ubuntu-latest`, and Node is `lts/*` from `.nvmrc`. When either is about to move, run the Deploy workflow by hand with the next runner image / Node line (`runner`, `node` inputs; untick `upload_secrets`) before the label gets there.
- **`pnpm test` (vitest, node environment) covers the pure logic behind accounts, billing, sync, lists and the support nudge** — `tests/*.test.ts`, see `vitest.config.mts`. That is where a bug is silent and expensive: who is entitled, whether a webhook is genuine, which way a sync conflict resolves, whether somebody gets asked for money twice. Run it after touching any of that.
- **Everything visual is verified in a browser, not by a test.** There are no component or DOM tests and none are wanted: drive the app.
- **Avoid `pnpm build` for routine verification** — it prerenders ~1000 pages and is slow (~40s). Use the dev server + a browser. Build only when specifically diagnosing a build/prerender issue or before a deploy.
- **`wrangler dev` holds `out/` open on Windows** — a rebuild while it runs dies with `EBUSY: rmdir 'out'`. Stop the dev task and kill stray `workerd` processes before `pnpm build:cf`.
- Path alias: `@/*` maps to repo root (e.g. `@/lib/fetch-client`).

## Architecture

### Layered data access (TMDB)

Everything flows through one governed client — **never add raw parallel `fetch()` calls to TMDB**.

- `lib/fetch-client.ts` — the single TMDB gateway. Wraps `fetch` with a **concurrency governor + 429 retry/backoff**. The governor is intentionally **active only during the build / dev** (`GOVERN` gates on `DEPLOY_TARGET` + `NEXT_PHASE`); in the production Worker runtime it flows straight through, because a module-global semaphore in a per-request isolate caused hangs (blank episode lists, React #418). The `DEPLOY_TARGET` clause matters: under Turbopack's export build `NEXT_PHASE` alone did not engage it and the build hit TMDB 429s. Read the long comments before touching this file — each guard fixes a specific past outage.
- `services/*.ts` (`movies`, `series`, `genres`, `imdb`, `watch-providers`) — typed read functions built on `fetchClient`. Wrapped in React `cache()` so a page's `generateMetadata` + body share one TMDB request.
- `cloudflare/worker.js` `/api/*` — what used to be `actions/*.ts` Server Actions. A static export cannot contain Server Actions, so client-driven fetches (search, filter, infinite scroll, genres, season details, watch providers) go over HTTP to the Worker, which calls **the same `services/*` functions the build calls**. `lib/api-client.ts` is the browser half; the Worker's router is the other half. Keep the query-string contract in those two files only.
- `dtos/`, `types/` — request/response shapes. `lib/tmdbConfig.ts` holds base URL + auth keys, as **lazy getters** — the Worker copies its secrets onto `process.env` on the first request, which is after module init.

Detail pages use TMDB **`append_to_response`** (`credits,similar,recommendations,videos`) so the whole page renders on **one** TMDB request — critical for the free-plan quotas.

### Cloudflare free-plan architecture (the core constraint)

Replaced OpenNext on 2026-08-03. Under OpenNext, prod was killing **25–40% of all Worker invocations** on the 10ms CPU budget: a detail id outside the prerendered set re-rendered React on every request (0.4–1.0s wall) and could never become a cache hit, because the incremental cache was read-only and Cloudflare will not edge-cache Worker-generated HTML. See `docs/superpowers/specs/2026-08-03-static-export-migration-design.md`.

- **Static assets match before the Worker runs.** Every prerendered page is a plain asset in `out/`: zero CPU, and it does not count against the 100k invocations/day cap. Next.js does not run in production at all.
- **The Worker (`cloudflare/worker.js`) only handles what cannot be static**: `/api/*` (`run_worker_first`), and detail/collection ids outside the prerendered set. A tail id costs one TMDB fetch plus an `HTMLRewriter` pass over an exported client shell (`app/media-fallback`, `app/collection-fallback`) into which it injects the real title, OG/Twitter tags, JSON-LD and a crawlable `<h1>` — so unfurlers and crawlers cannot tell a tail page from a prerendered one. Unknown ids get the 404 asset.
- **`caches.default` is keyed by URL + the Next build id.** The build id is not optional: cached fallback HTML references content-hashed chunks that the next deploy deletes, so without it a colo serves a page with dead scripts for the rest of its TTL and the client bounces off the stale-deploy boundary. `scripts/build-worker.mjs` stamps it in. It's the only cache the Worker's own output ever lands in — on a Workers Custom Domain the Worker runs ahead of the zone cache, so CF never stores Worker-generated HTML.
- **The zone DOES edge-cache the static document routes** (`CF-Cache-Status: HIT` on `/`, measured 2026-08-06) — they're assets, matched before the Worker. Nothing invalidates that cache on its own, so **freshness needs both**: the edge TTL held at the deploy interval (`scripts/cf-waf-setup.mjs` `edge_ttl`, `override_origin` — it wins over `s-maxage` in `public/_headers`), and the **purge after every deploy** in `scripts/cf-deploy.mjs` (opt out with `CF_PURGE=false`; a failed purge prints `::error::` because it silently pins the site to the old build). Older comments calling the cache rule a no-op describe the pre-2026-08-03 OpenNext layout — don't trust them.
- **`scripts/build-worker.mjs` inlines every `NEXT_PUBLIC_*` at bundle time.** Next inlines those textually for the app, but esbuild builds the Worker, so they would stay live lookups against a `process.env` holding only the two TMDB secrets — and an undefined `NEXT_PUBLIC_TMDB_BASEURL` 500s every API call in prod.
- **The 20,000-file asset cap is the real ceiling on site size.** A static export writes **~10 files per route** (Next 16's client segment cache; no flag disables it), so `LIST_DEPTH` in `lib/media-page.ts` is 15/8/3 → 1,037 routes / ~10,300 files. Re-measure `find out -type f | wc -l` before widening it. Prerender size no longer governs CPU, so widening buys freshness, not stability.
- **Static-first**: homepage and browse/list pages are fully static (`revalidate: false` on their TMDB fetches) and refresh only on the deploy — every 6h on cron (`.github/workflows/deploy.yml`), plus every push. **Deploy cadence is the site's only freshness control**, so a page's data is only as fresh as the TMDB endpoint behind it: the hero reads `trending/all/day`, not `/week` (a 7-day window sits still for weeks and made redeploys look pointless). `fetchClient.get(..., revalidate)` — pass `false` for build-only/static, a number for time-based ISR (default 8h).
- **`headers()` / `redirects()` do not exist under `output: 'export'`** — they live in `public/_headers` and `public/_redirects`, native to Workers Static Assets. **Cached paths must stay in sync with the CDN rule in `scripts/cf-waf-setup.mjs`.** `next.config.mjs` still defines them for the non-export build; `DEPLOY_TARGET=cloudflare` is what flips between the two configs.
- **WAF** (`scripts/cf-waf-setup.mjs`): scraper-challenge + rate-limit rules. The rate-limit rule **excludes `/*/genre`** (genre infinite-scroll would otherwise trip it). Run `pnpm waf:apply` after changing rules.
- **The payment webhook (`/api/billing/bmc`) is exempt from the UA challenge AND from the apex→www redirect**, and both exemptions are load-bearing: its callers are machines with no user-agent, and a 301 is not a 2xx, so a sender that does not follow redirects loses the delivery while the money still lands. `pnpm bmc:probe` proves the whole path against production (signature, WAF, both hosts, grant, revoke, replay) in ~10s — run it after touching WAF rules, `lib/billing/*`, or the offer names in `config/support.ts`.

- **The supporter calendar feed (`/api/calendar/<token>.ics`) carries the same two exemptions**, for the same reason: what polls it is Google/Apple/Outlook's fetcher, not a browser. A challenge turns a subscription permanently red, and a 301 loses the poll on any client that does not follow it. Both are prefix matches in `scripts/cf-waf-setup.mjs` (`CALENDAR_PREFIX`) — run `pnpm waf:apply` after touching them.
- **`/api/upcoming` and the feed are one D1 JOIN with zero TMDB traffic.** The hourly sweep already writes `watched_media.next_air_date` for every watchlisted title (it must, to send alerts), so the schedule is a read over rows that exist for another reason. Keep it that way: a per-title TMDB call here would reintroduce the 50-subrequest problem. Migration `0002_calendar_feed.sql` adds `users.calendar_token`, `0003_media_runtime.sql` adds `watched_media.runtime` (written by the sweep, read by nothing yet — it is there so hours-watched can be answered from D1 alone later) — **CI applies migrations before every deploy** (`.github/workflows/deploy.yml`, "Apply D1 migrations", ahead of `deploy:full`); a failure there stops the deploy with the old Worker still serving. Run `pnpm d1:migrate:remote` by hand only to land a schema change ahead of its push.

### Streaming servers

The embed provider list lives in `config/sources.ts` and comes **entirely from the environment** — `NEXT_PUBLIC_STREAMING_MOVIES_API_URL` plus `NEXT_PUBLIC_STREAM_SOURCE_2/3/4/5`, mirrored as GitHub secrets **and mapped into the build step of `.github/workflows/deploy.yml`** — a secret added to GitHub without a workflow mapping is silently absent from prod (Turbopack only inlines what exists at build time). No provider host is checked in (this repo is public) and the UI labels them "Server N". Screen any candidate with `pnpm embed:probe` before adding it. Switching, the one automatic hop after a 9s stall, and the per-title memory need a **free account** (`canSwitch` in `hooks/use-stream-source.ts`); anonymous visitors get the default server. Supporters start every title on the Reely Player; everyone else gets it on **one title a day** (offered on the stall screen by `lib/player-trial.ts`, enforced by `lib/pro/ticket-access.ts`). Both detail heroes hold _what_ is playing and derive the URL from the chosen server — never store the URL.

### Kodi add-on

`kodi/plugin.video.reely` is a supporter-only add-on (Kodi 19+; Vega OS Fire TVs cannot run Kodi). A TV signs in by device code at `/link`, and its token is an ordinary `sessions` row sent as a bearer (`lib/auth/device.ts`). Embeds can never play in Kodi, so it only reaches the Reely Player. `pnpm kodi:probe` proves every path against production. See `docs/kodi.md`.

**`/api/pro/ticket` is the Reely Player's paywall, and `lib/pro/ticket-access.ts` is all of it**: a signed ticket is the only thing the private worker asks for. Supporters always pass, a linked TV must be a supporter, and everyone else gets one title in 24 hours from a `player_trials` row (by account, or a keyed hash of the address when signed out). `lib/player-trial.ts` only decides what the browser offers. There is deliberately no flag: `keep_vars` in `wrangler.jsonc` means a removed var can survive in the dashboard, so the old `PRO_PLAYER_OPEN` switch was removed from the code, not just the config.

### Ratings on the details page (free, no paid API)

Four scores on every details page — IMDb, Rotten Tomatoes, Metacritic, TMDB — in `components/media/ratings-strip.tsx`, and **not one of them costs a TMDB request**, which is the whole constraint: the detail payload already carries the `imdb_id`.

- **IMDb** — the free Non-Commercial dataset, prebuilt into 256 shards by `pnpm imdb:ratings` and read off disk at build. Gated by **`IMDB_RATING_SHARDS`** (CI env, ON). It is deliberately **not** a `NEXT_PUBLIC_*` var: those are inlined into the Worker bundle, which would switch the Worker's detail path on too — one more subrequest and one more JSON parse on the route that is 63% of all invocations. The shards live in **`.cache/`** (a build input), not `public/`: nothing fetches them at runtime, so shipping them would be 256 dead files against the 20,000-file asset cap.
- **Rotten Tomatoes + Metacritic** - OMDb's free tier (1,000 requests/day, no card). There is **no free official RT API**; the unofficial ones are somebody else's server. The answers live in **data/media-ratings.json**, committed to the repository, and the build **never calls OMDb**: it reads the file. A separate scheduled job (.github/workflows/ratings.yml, daily) asks OMDb for what is missing, merges it and commits it - so a deploy is quota-free and cannot be slowed by a third party's cap, and the daily quota is spent once, on titles nobody has looked up yet. pnpm ratings:refresh is that job, by hand.
- **Per-item enrichment of LIST rows** is a different flag (`IMDB_RATING_LISTS`) and stays **OFF**: one `external_ids` subrequest per row is what blew the free-plan **50-subrequests/invocation** cap (homepage 500 / Error 1102). `NUM_SHARDS` must stay in sync between `services/imdb.ts` and `scripts/build-imdb-ratings.mjs`.

The strip is **server-rendered into the prerendered pages**: zero Worker CPU, zero subrequests, and the numbers are in the HTML for a crawler. The Worker's tail-id fallback does not show ratings (it serves the exported shell).

### Client state & URL

- **Filters/search state live in the URL via `nuqs`** (shareable, back-button friendly). Transient UI chrome (open accordions) is deliberately kept out of the URL. The browse filter sidebar is **CSR-hydrated** (nuqs `useSearchParams` bailout) — curl / prod-SSR cannot render its state, so **verify filters in a real browser only**.
- Personal data (watchlist, watch history, recent searches) is **localStorage-only, no account/server** — see `hooks/use-watchlist.ts`, `use-watched-media.ts`, `use-recent-searches.ts` and `use-local-storage.ts`.
- TanStack Query drives infinite scroll (`use-infinite-scroll.ts` + `react-intersection-observer`).

### App Router layout

`app/` uses route groups: `(landing)` home, `movies` / `tv-shows` with `(…-list)`, `genre/[slug]`, and `[id]/(…-details)` segments, `collection/[id]`, `watchlist`, `watch-history`, plus the two noindex fallback shells (`media-fallback`, `collection-fallback`) the Worker serves under tail ids. SEO is prerendered: `sitemap.ts`, `robots.ts` (both need `dynamic = 'force-static'` under export), JSON-LD in `lib/structured-data.tsx`, static OG in `app/_og`.

- **The sitemap advertises what the site LINKS to, not what the build bakes.** Beyond the prerendered set it harvests the similar/recommended ids on every detail page (`buildLinkedMediaIds`) — those anchors are in the HTML, so a crawler walks straight off the baked set, and Bing reported the pages it landed on as missing from the sitemap. ~14,900 URLs / 3.7 MB, inside the 50,000-URL limit; it is free of extra TMDB traffic (same service function the detail page renders from, so the build fetch cache serves the second read) but it makes `/sitemap.xml` a ~1,800-request route, which is why `staticPageGenerationTimeout: 300` exists in `next.config.mjs`. `pnpm deploy` then submits every one of those URLs to IndexNow.
- **A tail page must have a BODY, not just meta tags.** `lib/seo-facts.ts` builds the crawler block — a generated sentence, the full synopsis, a fact list, and genre/year/franchise links — entirely out of the plain detail payload the Worker already fetches (`services/media-summary.ts`: every field it reads rides along in that same 1.7KB response, so there is no extra request and no extra CPU). Before it, a tail page carried 1,393 visible characters against 2,405 on a prerendered one, the rest being chrome identical across ~13,900 URLs, and Google filed them as Soft 404 / duplicate / crawled-not-indexed. Compare a fallback to a baked page by visible character count, not by which meta tags are present.
- **The person set is a committed file, `data/people.json`, refreshed by `pnpm people:refresh` (which unions, never replaces).** `/person/[id]` is `dynamicParams = false` with no Worker fallback, so an id outside the set is a hard 404 — and the set used to be TMDB `person/popular` read at build time, which moves daily. Every deploy therefore deleted person pages the sitemap had already advertised, and Search Console reported them as 404. Never prerender a closed set from a list that moves.
- **Meta descriptions come from one builder, `lib/seo-description.ts`**, shared by the prerendered detail pages and the Worker's tail-id fallback. Don't reintroduce a local `overview.slice(...)` — a thin TMDB overview is what made Bing flag 53 pages.
- **The Worker's crawler-only `<h1>` block must never be `hidden`.** `display: none` reads as absent to a crawler (that is the "h1 missing" report); it is clipped + `aria-hidden` instead. `pnpm seo:verify` asserts all of the above against production.

**No Suspense or `loading.tsx` around above-the-fold content on a static route.** React writes any boundary over 12.8KB out of line even when it has finished rendering: the markup lands in a hidden div near the end of the document, the fallback paints first, and the `<h1>` needs JavaScript to show. Next does not expose the threshold. Client navigation feedback is `LinkPendingBar`. Rails keep their boundaries, which give React separate hydration tasks, and every homepage rail is a `LazyRail`: a `StaticRail` until the page has loaded and it is near the viewport, because hydrating cards was most of TBT. Do not turn on `experimental.inlineCss`: it took the Worker from 472KB to 2.8MB. `tests/first-paint-shell.test.ts` and `pnpm seo:verify` pin this.

**Intercepting routes are unsupported by `output: 'export'`** — the `@modal` slot is gone and the disclaimer is an ordinary full-page navigation. Don't reintroduce one.

### Analytics

PostHog **client-side only** — all events centralized in `lib/analytics.ts`. Server-side capture (`instrumentation.ts`, `lib/posthog-server.ts`) is deleted: there is no server left to throw. Source maps are uploaded to PostHog at build time via `withPostHogConfig` (gated on `POSTHOG_API_KEY` + CI) so minified prod stack traces symbolicate.

- **Follows the cross-project standard** in `~/.claude/rules/posthog.md`. `track()` is typed to `EVENTS`, stamps `area` (`EVENT_AREA` — a new event without one does not compile), advances the visit counter and derives `first_play` / `first_core_use` (`lib/analytics-context.ts`). The long tail is `trackFeatureUsed({feature, action, outcome})` with `FEATURE_AREA`; prefs, shares and retries report from their single choke points (`savePrefs`, `useShare`, the retry buttons). `tests/analytics-coverage.test.ts` fails on an event nothing calls.
- **A new feature adds a `FEATURE_AREA` line and a `trackFeatureUsed` call; a swallowed `catch` on a real fetch calls `trackApiError`** (`expected: true` for network failures, which skips the Error Tracking issue).
- `pnpm posthog:issues` (error board + `gate`), `pnpm posthog:usage` (reach by area, funnels, WHAT TO DO), `pnpm posthog:setup` (applies `scripts/posthog-dashboards.mjs`: the three dashboards, alerts, project settings — idempotent; `--check` runs every HogQL tile on real data). Every deploy posts a PostHog annotation.

## Code style (enforced conventions)

- **No nested ternaries** — extract a small pure module-scoped helper instead. Simple single-level ternaries are fine.
- Prefer pure helper functions over inline branching; `useMemo`/`React.memo` for non-trivial compute or referential stability.
- Prettier: **no semicolons, single quotes, 2-space, es5 trailing commas**. Imports are auto-sorted by `@ianvs/prettier-plugin-sort-imports` — the group order is defined in `prettier.config.js`; don't hand-reorder against it.
- **Commit subjects must start with the Conventional Commit type** (`feat`/`fix`/`docs`/…) — no leading/trailing `@` or paste artifacts (this bit us once). **Do not add a `Co-Authored-By: Claude` trailer** in this repo.

## Environment

Copy `.env.sample` → `.env.local`. Only the TMDB vars (`TMDB_API_KEY`, `TMDB_HEADER_KEY`, `NEXT_PUBLIC_TMDB_BASEURL`) + app URLs are required to run locally; everything else (IMDb flag, PostHog, SEO verification, deploy token) is optional and degrades gracefully.
