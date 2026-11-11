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
pnpm build              # next build (rarely needed)

# Cloudflare (static export + Worker)
pnpm build:cf           # static export to out/ + bundle .cloudflare/worker.mjs
pnpm preview            # build:cf + wrangler dev (real workerd runtime)
pnpm deploy             # deploy via scripts/cf-deploy.mjs (needs CLOUDFLARE_API_TOKEN)
pnpm deploy:full        # build:cf + deploy

# One-off asset/data builds
pnpm imdb:ratings       # regenerate public/imdb-ratings/*.json shards
pnpm og:build           # regenerate the static OG image
pnpm waf:apply          # push Cloudflare WAF + CDN cache rules
pnpm share:probe        # a real list and profile unfurled through D1, the Worker and wsrv
pnpm hop:probe          # a played stream is never taken from the viewer (real page AND real player)
pnpm resume:probe       # resume + playback prefs through the real page AND real player
pnpm relay:canary       # can the Reely Player play? ticket, shell, relay walk to a segment
pnpm cf:health [hours]  # production health: kills, invocations, eyeball 5xx, crawlers
pnpm cf:cpu [hours]     # production Worker CPU BY ROUTE (Workers Logs)
pnpm lighthouse         # medians; prefer the Lighthouse workflow, a home connection measures itself
```

- **pnpm 12 only** (never npm/yarn); install, CI and Windows `out/` gotchas, and what the probes need: `.claude/rules/toolchain.md`.
- **`pnpm test` (vitest, node environment) covers the pure logic behind accounts, billing, sync, lists and the support nudge** (`tests/*.test.ts`), where a bug is silent and expensive: who is entitled, which way a sync conflict resolves, whether somebody is asked for money twice. Run it after touching any of that.
- **Everything visual is verified in a browser, not by a test.** There are no component or DOM tests and none are wanted: drive the app.
- **Avoid `pnpm build` for routine verification** (~1000 prerendered pages, ~40s); use the dev server + a browser. Build only to diagnose a build/prerender issue.
- Path alias: `@/*` maps to repo root (e.g. `@/lib/fetch-client`).

## Architecture

Loaded on demand (path-scoped rules in `.claude/rules/`, read the one matching the work):

- `.claude/rules/data-access.md` — layered TMDB data access, streaming servers, IMDb ratings, client state and URL. Read before touching `lib/`, `services/`, `hooks/`, `providers/`.
- `.claude/rules/cloudflare.md` — the free-plan architecture (the core constraint). Read before touching the Worker, `wrangler.jsonc`, `db/`, `migrations/`, `scripts/` or any caching/routing.
- `.claude/rules/kodi.md` — the Kodi add-on. Read before touching `kodi/` or `app/kodi/`.
- `.claude/rules/app-layout.md` — App Router layout. Read before adding or moving a route or component under `app/` or `components/`.
- `.claude/rules/analytics.md` — PostHog events and scripts. Read before adding an event, a feature, or a swallowed `catch`.

## Code style (enforced conventions)

- **No nested ternaries** — extract a small pure module-scoped helper instead. Simple single-level ternaries are fine.
- Prefer pure helper functions over inline branching; `useMemo`/`React.memo` for non-trivial compute or referential stability.
- Prettier: **no semicolons, single quotes, 2-space, es5 trailing commas**. Imports are auto-sorted by `@ianvs/prettier-plugin-sort-imports` — the group order is defined in `prettier.config.js`; don't hand-reorder against it.
- **Commit subjects must start with the Conventional Commit type** (`feat`/`fix`/`docs`/…) — no leading/trailing `@` or paste artifacts (this bit us once). **Do not add a `Co-Authored-By: Claude` trailer** in this repo.

## Environment

Copy `.env.sample` → `.env.local`. Only the TMDB vars (`TMDB_API_KEY`, `TMDB_HEADER_KEY`, `NEXT_PUBLIC_TMDB_BASEURL`) + app URLs are required to run locally; everything else (IMDb flag, PostHog, SEO verification, deploy token) is optional and degrades gracefully.
