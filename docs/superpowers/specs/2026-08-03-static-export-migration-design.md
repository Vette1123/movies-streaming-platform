# Static export + a small Worker: removing the render from the request path

Date: 2026-08-03
Status: approved, not yet implemented

## Why

Prod is failing a quarter to a half of all Worker invocations.

`exceededResources` share of `workersInvocationsAdaptive`, measured 2026-08-03:

| day    | invocations | killed | share |
| ------ | ----------- | ------ | ----- |
| Jul 31 | 35,204      | 11,034 | 31%   |
| Aug 1  | 47,308      | 11,796 | 25%   |
| Aug 2  | 31,305      | 12,475 | 40%   |

Hourly peaks reach 67%. Traffic is flat across the window, so this is cost per
request, not load.

Prod response headers say exactly what costs the CPU:

```
/movies/550    (prerendered)     -> x-opennext-cache: HIT   no render
/movies/47090  (not prerendered) -> x-nextjs-cache: MISS    renders EVERY hit
/              (homepage)        -> x-nextjs-cache: HIT     NextServer still runs
```

The incremental cache is read-only and Cloudflare will not edge-cache
Worker-generated HTML, so a MISS can never become a HIT. Every request for a
detail id outside the prerendered set pays a full React render — measured
0.4–1.0s wall — against a 10ms CPU budget. The sampled 503 path list is almost
entirely `/movies/<id>` and `/tv-shows/<id>` from outside that set.

Widening the prerendered set (`f3754e2`, 1,921 → ~4,200 routes) shrinks the miss
surface. It cannot close it: TMDB has ~1M ids and crawlers walk them.

The structural answer is to stop rendering on the server at all.

## Goals

1. Page views cost **zero** Worker invocations. Not "cheap" — zero.
2. Tail detail ids keep working, keep their metadata, and keep being indexable.
3. No feature regression that a user can observe.
4. Prove it with numbers before and after, not by assertion.

## Non-goals

- Redesigning any UI.
- Changing what data the pages show.
- Adding a database, an account system, or server-side personalization.

## Architecture

Static export (`output: 'export'`) produces `out/`. Wrangler uploads `out/` as
Workers Static Assets. A single hand-written Worker handles `/api/*` and the
tail-id fallback. Next.js does not run in production.

Workers Static Assets match **before** the Worker is invoked, so routing falls
out of the file layout with no rules to maintain:

| request                                                                 | served by                   | Worker CPU                |
| ----------------------------------------------------------------------- | --------------------------- | ------------------------- |
| `/`, `/movies`, `/movies/550`, genre, collection, watchlist, disclaimer | static asset                | none — Worker not invoked |
| `/api/*`                                                                | Worker (`run_worker_first`) | ~1–3ms                    |
| `/movies/47090` (tail id, no matching asset)                            | Worker fallback             | ~1–3ms                    |

This is the same shape as `social-media-downloader`, which already runs this way
on the same free plan.

### Component 1: the Worker

One script at `cloudflare/worker.js`, no framework adapter, wired as `main` in
`wrangler.jsonc` with `assets.directory: "out"` and
`assets.run_worker_first: ["/api/*"]`. Two responsibilities.

**API routes.** The five Server Actions and the one Route Handler become plain
endpoints. The TMDB key stays server-side exactly as it is today — it moves from
a Next server action into a Worker secret, never to the client.

| today                          | becomes                                               |
| ------------------------------ | ----------------------------------------------------- |
| `actions/search.ts`            | `GET /api/search?q=`                                  |
| `actions/filter.ts`            | `GET /api/filter?…`                                   |
| `actions/genres.ts`            | `GET /api/genres?…`                                   |
| `actions/season-details.ts`    | `GET /api/season-details?…`                           |
| `actions/watch-providers.ts`   | `GET /api/watch-providers?…`                          |
| `app/api/hero-extras/route.ts` | `GET /api/hero-extras`                                |
| (new)                          | `GET /api/media/:type/:id` — powers the tail fallback |

Every response is read from and written to `caches.default` keyed by request URL.
A repeat hit costs no TMDB subrequest and sub-millisecond CPU. This is the
in-Worker Cache API that `scripts/cf-waf-setup.mjs` already documents as the only
thing that can cache Worker output on this zone — a zone cache rule cannot,
because on a Workers Custom Domain the Worker runs ahead of the zone cache.

**Tail-id fallback.** For a detail path with no matching asset:

1. `ASSETS.fetch()` the static fallback shell.
2. Fetch `/api/media/:type/:id` (served from `caches.default` on repeat).
3. Pipe the shell through `HTMLRewriter` — streaming, sub-millisecond — injecting
   `<title>`, meta description, OG + Twitter tags, JSON-LD, and an `<h1>` plus
   overview into the body.
4. Return **200** with the same `Cache-Control` the prerendered pages carry, and
   store it in `caches.default`.

Unknown/invalid ids return the real 404 asset with a 404 status.

### Component 2: the fallback shell

A client page at `app/_fallback/media/page.tsx`, exported to
`out/_fallback/media/index.html` — one shell serving both media types. It reads
the type and id from `window.location.pathname`, fetches
`/api/media/:type/:id`, and renders
`MovieDetailsHero` + `MoviesDetailsContent` (or the TV pair).

This is cheap because those components are already props-driven —
`MovieDetailsHero` is already `'use client'`, and the current server page is a
thin wrapper that fetches, builds JSON-LD, and passes props. The fallback reuses
the same components with the same props from a different data source, so a tail
page is visually and behaviourally identical to a prerendered one.

### Component 3: config that must move

`output: 'export'` does not support `headers()` or `redirects()`. Both are in use
and both must be ported or they vanish silently:

- `headers()` — security headers (`X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`) and the 8h `Cache-Control` → `public/_headers`.
- `redirects()` — the `sitemap-*.xml` → `sitemap.xml` permanent redirects →
  `public/_redirects`.

Both files are native to Workers Static Assets.

`instrumentation.ts` and `lib/posthog-server.ts` are deleted: there is no server
left to throw. Client-side capture in `lib/analytics.ts` is untouched.

### What is removed

`@opennextjs/cloudflare`, `@opennextjs/aws`, `open-next.config.ts`, the
`NEXT_INC_CACHE_KV` binding, and the incremental-cache machinery. A side effect
worth having: the symlink `EPERM` that makes a worker build impossible on Windows
is an OpenNext behaviour, so `pnpm preview` starts working locally again instead
of CI being the only place a production build can be verified.

## Data flow

```
prerendered page   browser -> CF edge -> static asset            (no Worker)
tail detail page   browser -> Worker -> caches.default hit       (~0 CPU)
                                     -> miss: ASSETS + TMDB + HTMLRewriter
client fetch       browser -> Worker -> caches.default or TMDB
```

## Error handling

- TMDB fails on a tail id: serve the 404 asset with a 404 status. Never a 5xx.
- TMDB fails on an `/api/*` call: return the upstream status with a JSON error
  body; the existing TanStack Query error states already handle a failed fetch.
- The Worker throws: `caches.default` and the asset store are unaffected, so
  every prerendered page stays up. This is the property that makes "never goes
  down" true — the Worker is no longer in the path of the site's own pages.

## Testing and verification

Nothing here is claimed until it is run. No test runner is configured in this
repo, so verification is a browser and a set of probes, per the project's own
convention.

**Spikes, before the plan is finalized (blocking):**

1. Does `app/@modal/(.)disclaimer` — an intercepting route — survive
   `output: 'export'`? If not, the fallback is the disclaimer opening as a full
   page, which is a one-line route change.
2. Does the widened `generateStaticParams` set export cleanly, and how many files
   does `out/` contain against the 20,000-file cap? Current OpenNext build: 4,047
   files at 1,921 routes.

**Pre-merge:**

- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm prettier:check`.
- `pnpm preview` locally (now possible on Windows) and drive every route in a
  real browser: home, movies list, TV list, both genre routes, a prerendered
  detail page, a tail detail page, a collection, watchlist, watch history,
  disclaimer.
- Exercise all five migrated actions in the browser: search from the command
  menu, the browse filter sidebar (which is CSR-hydrated and cannot be verified
  by curl), genre infinite scroll, a TV season expansion, watch providers.
- Confirm `public/_headers` and `public/_redirects` are applied by the local
  preview.

**Post-deploy:**

- Probe headers: prerendered pages must carry **no** `x-nextjs-cache` /
  `x-opennext-cache` header at all (they are plain assets now); tail ids must
  return 200 with correct `<title>` and `og:` tags in the raw HTML — check with
  curl, not a browser, because that is what an unfurler sees.
- Re-run the `workersInvocationsAdaptive` query at +2h, +24h.
- Watch Cloudflare request counts against the free 100k/day cap: page views stop
  counting entirely, so total invocations should fall from ~31k/day to the
  low thousands.

**Success criteria — the migration is a real win only if all hold:**

| metric                             | today                 | target                            |
| ---------------------------------- | --------------------- | --------------------------------- |
| `exceededResources` share          | 25–40%                | < 1%                              |
| Worker invocations/day             | ~31,000               | < 5,000                           |
| Prerendered page render            | NextServer runs       | never invoked                     |
| Tail id `<title>` + OG in raw HTML | yes (server-rendered) | yes (injected)                    |
| Feature regressions                | —                     | none observed in the browser pass |

If the kill rate does not drop below 1%, the migration has not solved the
problem and the cause is somewhere this design did not look.

**Rollback:** the OpenNext config is one commit away and `wrangler.jsonc` keeps
its existing bindings, so reverting is a `git revert` plus a redeploy. The
prerendered asset set is identical either way.

## Risks

- **Intercepting route** may not survive export (spike 1). Low impact.
- **Asset count** grows with the prerender set; the 20k cap is the real ceiling
  on how many pages this site can have. At ~4,200 routes we expect to sit near
  half of it. Spike 2 measures it.
- **Tail pages are client-rendered for the body.** Unfurlers read only the head,
  which is injected, so they are unaffected. Googlebot executes JS. Other
  crawlers see the injected `<h1>` and overview but not the full cast list —
  accepted, because these ids are outside the indexed catalog by definition.
- **Two implementations of the same TMDB read** (Next services at build, Worker
  at runtime) could drift. Mitigated by having the Worker call the same TMDB URL
  shapes, and by `/api/media/:type/:id` returning the same payload the detail
  page props expect.
