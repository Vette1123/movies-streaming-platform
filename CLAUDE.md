# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Reely** — a TMDB-powered movie/TV discovery, tracking, and streaming app. Next.js 16 (App Router, RSC + Server Actions, Turbopack) + React 19 + TypeScript 6 + Tailwind 4. Deployed to **Cloudflare Workers via OpenNext** — most non-obvious constraints in this codebase exist to stay inside the Cloudflare **free plan** limits.

## Commands

```bash
pnpm dev                # dev server (Turbopack) — http://localhost:3000
pnpm lint               # next lint (ESLint 9)
pnpm prettier:check     # verify formatting; prettier:format to write
pnpm build              # next build (rarely needed locally — see below)

# Cloudflare Workers (OpenNext)
pnpm preview            # build worker + run it locally (real runtime)
pnpm deploy             # deploy via scripts/cf-deploy.mjs (needs CLOUDFLARE_API_TOKEN)
pnpm deploy:full        # build worker + deploy

# One-off asset/data builds
pnpm imdb:ratings       # regenerate public/imdb-ratings/*.json shards
pnpm og:build           # regenerate the static OG image
pnpm waf:apply          # push Cloudflare WAF + CDN cache rules
```

- **Package manager is pnpm 10** (`packageManager` pin). Do not use npm/yarn.
- **No test runner is configured.** Verify changes by driving the app in a browser, not by a test suite.
- **Avoid `pnpm build` for routine verification** — it prerenders ~1800 pages and is slow. Use the dev server + a browser. Build only when specifically diagnosing a build/prerender issue or before a deploy.
- Path alias: `@/*` maps to repo root (e.g. `@/lib/fetch-client`).

## Architecture

### Layered data access (TMDB)

Everything flows through one governed client — **never add raw parallel `fetch()` calls to TMDB**.

- `lib/fetch-client.ts` — the single TMDB gateway. Wraps `fetch` with a **concurrency governor + 429 retry/backoff**. The governor is intentionally **active only during `next build` / dev** (`GOVERN` gate on `NEXT_PHASE`); in the production Worker runtime it flows straight through, because a module-global semaphore in a per-request isolate caused hangs (blank episode lists, React #418). Read the long comments before touching this file — each guard fixes a specific past outage.
- `services/*.ts` (`movies`, `series`, `genres`, `imdb`, `watch-providers`) — typed read functions built on `fetchClient`. Wrapped in React `cache()` so a page's `generateMetadata` + body share one TMDB request.
- `actions/*.ts` (`filter`, `genres`, `search`, `season-details`, `watch-providers`) — `'use server'` Server Actions, mostly for client-driven fetches (filtering, infinite scroll, search).
- `dtos/`, `types/` — request/response shapes. `lib/tmdbConfig.ts` holds base URL + auth keys.

Detail pages use TMDB **`append_to_response`** (`credits,similar,recommendations,videos`) so the whole page renders on **one** TMDB request / one KV write — critical for the free-plan quotas.

### Cloudflare free-plan caching (the core constraint)

- **Static-assets incremental cache** (`open-next.config.ts`): prerendered pages are read through the `ASSETS` binding from `cdn-cgi/_next_cache`, which `populateCache` copies out of `.open-next/cache` at deploy. Free, no quota, no KV in the request path. It is **read-only** — no on-demand or time-based revalidation, content changes only on the 4×/day redeploy. Replaced the regional-cache + KV tiers on 2026-07-31: KV writes ran past the free 1k/day cap, so the cache went unpopulated and static pages re-rendered per request (Worker CPU kills hit 41% of invocations). The `NEXT_INC_CACHE_KV` binding is left in `wrangler.jsonc` so the old config can be restored by editing one file.
- **Static-first**: homepage and browse/list pages are fully static (`revalidate: false` on their TMDB fetches) and refresh only on the ~4×/day deploy. `fetchClient.get(..., revalidate)` — pass `false` for build-only/static, a number for time-based ISR (default 8h).
- **Edge cache headers** (`next.config.mjs headers()`): overrides Next's default `no-store` so the Cloudflare CDN keeps rendered pages 8h. **Cached paths here must stay in sync with the CDN rule in `scripts/cf-waf-setup.mjs`.**
- **WAF** (`scripts/cf-waf-setup.mjs`): scraper-challenge + rate-limit rules. The rate-limit rule **excludes `/*/genre`** (genre infinite-scroll would otherwise trip it). Run `pnpm waf:apply` after changing rules.

### IMDb ratings (feature-flagged OFF)

`NEXT_PUBLIC_IMDB_RATINGS` gates all IMDb code. **Off by default**: enriching list rows fired one TMDB `external_ids` subrequest per item and blew the free-plan **50-subrequests/invocation** cap (homepage 500 / Error 1102). When on, ratings come from prebuilt static shards (`public/imdb-ratings/*.json`, 256 shards, `pnpm imdb:ratings`), read at runtime via the **Workers `ASSETS` binding — not a public self-fetch** (the WAF challenges the empty-UA subrequest and returns HTML). `NUM_SHARDS` must stay in sync between `services/imdb.ts` and `scripts/build-imdb-ratings.mjs`.

### Client state & URL

- **Filters/search state live in the URL via `nuqs`** (shareable, back-button friendly). Transient UI chrome (open accordions) is deliberately kept out of the URL. The browse filter sidebar is **CSR-hydrated** (nuqs `useSearchParams` bailout) — curl / prod-SSR cannot render its state, so **verify filters in a real browser only**.
- Personal data (watchlist, watch history, recent searches) is **localStorage-only, no account/server** — see `hooks/use-watchlist.ts`, `use-watched-media.ts`, `use-recent-searches.ts` and `use-local-storage.ts`.
- TanStack Query drives infinite scroll (`use-infinite-scroll.ts` + `react-intersection-observer`).

### App Router layout

`app/` uses route groups and parallel routes: `(landing)` home, `movies` / `tv-shows` with `(…-list)`, `genre/[slug]`, and `[id]/(…-details)` segments, `collection/[id]`, `watchlist`, `watch-history`, plus a `@modal` parallel slot for the intercepted disclaimer. SEO is server-rendered: `sitemap.ts`, `robots.ts`, JSON-LD in `lib/structured-data.tsx`, dynamic OG in `app/_og`.

### Analytics

PostHog (client + server), all events centralized in `lib/analytics.ts`. Source maps are uploaded to PostHog at build time via `withPostHogConfig` (gated on `POSTHOG_API_KEY` + CI) so minified prod stack traces symbolicate.

## Code style (enforced conventions)

- **No nested ternaries** — extract a small pure module-scoped helper instead. Simple single-level ternaries are fine.
- Prefer pure helper functions over inline branching; `useMemo`/`React.memo` for non-trivial compute or referential stability.
- Prettier: **no semicolons, single quotes, 2-space, es5 trailing commas**. Imports are auto-sorted by `@ianvs/prettier-plugin-sort-imports` — the group order is defined in `prettier.config.js`; don't hand-reorder against it.
- **Commit subjects must start with the Conventional Commit type** (`feat`/`fix`/`docs`/…) — no leading/trailing `@` or paste artifacts (this bit us once). **Do not add a `Co-Authored-By: Claude` trailer** in this repo.

## Environment

Copy `.env.sample` → `.env.local`. Only the TMDB vars (`TMDB_API_KEY`, `TMDB_HEADER_KEY`, `NEXT_PUBLIC_TMDB_BASEURL`) + app URLs are required to run locally; everything else (IMDb flag, PostHog, SEO verification, deploy token) is optional and degrades gracefully.
