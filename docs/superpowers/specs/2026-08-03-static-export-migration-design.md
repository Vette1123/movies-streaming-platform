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
| `/collection/645` (tail franchise id)                                   | Worker fallback             | ~1–3ms                    |

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
| (new)                          | `GET /api/collection/:id` — powers the tail fallback  |
| (new)                          | `GET /api/popular?mediaType=&page=` — list page 2+    |

`/api/popular` was not in the original plan. The browse lists passed
`getPopularMediaAction` down as a prop for infinite scroll; a static export
cannot pass a function to a client component, so page 2+ became an endpoint like
the rest.

Every response is read from and written to `caches.default`, keyed by request URL
**plus the Next build id**. A repeat hit costs no TMDB subrequest and
sub-millisecond CPU. This is the in-Worker Cache API that
`scripts/cf-waf-setup.mjs` already documents as the only thing that can cache
Worker output on this zone — a zone cache rule cannot, because on a Workers
Custom Domain the Worker runs ahead of the zone cache.

The build id in the key is not cosmetic. A cached fallback page is HTML that
references `_next/static/chunks/*` by content hash, and a deploy deletes the old
hashes. Without the build id, a colo that cached a tail page before a deploy
serves it for the rest of its 8h TTL with scripts that 404 — the client boundary
reads that as a stale deploy and reloads onto the same cached entry, so the page
stays dead until it expires. Reproduced locally across two builds; keying by
build id makes each deploy start from an empty Worker cache.

**Tail-id fallback.** For a detail path with no matching asset:

1. `ASSETS.fetch()` the static fallback shell.
2. Fetch `/api/media/:type/:id` (served from `caches.default` on repeat).
3. Pipe the shell through `HTMLRewriter` — streaming, sub-millisecond — injecting
   `<title>`, meta description, OG + Twitter tags, JSON-LD, and an `<h1>` plus
   overview into the body.
4. Return **200** with the same `Cache-Control` the prerendered pages carry, and
   store it in `caches.default`.

Unknown/invalid ids return the real 404 asset with a 404 status.

### Component 2: the fallback shells

A client page at `app/media-fallback/page.tsx`, exported to
`out/media-fallback.html` (`trailingSlash` is false, so no `index.html`
directory) — one shell serving both media types. It reads the type and id from
`window.location.pathname`, fetches `/api/media/:type/:id`, and renders
`MovieDetailsHero` + `MoviesDetailsContent` (or the TV pair).

This is cheap because those components are already props-driven —
`MovieDetailsHero` is already `'use client'`, and the current server page is a
thin wrapper that fetches, builds JSON-LD, and passes props. The fallback reuses
the same components with the same props from a different data source, so a tail
page is visually and behaviourally identical to a prerendered one.

`app/collection-fallback/page.tsx` is the same shape for `/collection/:id`. The
prerendered franchise set is derived from `belongs_to_collection` on prerendered
movies, so before this existed, a tail movie's "part of X collection" link was
the last dead link on the site. Adding it meant lifting the collection page's
JSX into `components/collection/collection-view.tsx`, now rendered by both the
prerendered route (on the server, at build) and the shell (in the browser).

Both shells carry `robots: { index: false, follow: false }` — the bare
`/media-fallback` URL is an empty shell and must not compete with the real
detail URLs, which the Worker gives a proper canonical.

Each shell re-sets `document.title` once its data arrives. The Worker injects
the real title into the HTML, which is what crawlers and unfurlers read, but
hydration re-renders the shell's own title — without the effect the tab reverts
to the generic site title as soon as the page becomes interactive.

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

The public config must also move **into the Worker bundle**. Next inlines every
`process.env.NEXT_PUBLIC_*` textually when it builds the app, but esbuild builds
the Worker, so the same reads stay live lookups against a workerd `process.env`
that only carries what Cloudflare was given — which is the two TMDB secrets and
nothing else. `scripts/build-worker.mjs` therefore inlines every `NEXT_PUBLIC_*`
that is set at build time, reproducing what Next does for the app half. Without
it `NEXT_PUBLIC_TMDB_BASEURL` is undefined in production and every `/api/*` call
and tail page 500s. Secrets are deliberately not inlined; they stay runtime reads
fed by `copyEnv()` from the Worker's secret store.

The `@modal` parallel slot and its intercepting `(.)disclaimer` route are
deleted — intercepting routes are not supported under `output: 'export'`. The
disclaimer is now an ordinary full-page navigation.

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

**Spikes, before the plan is finalized (blocking) — both resolved:**

1. Does `app/@modal/(.)disclaimer` — an intercepting route — survive
   `output: 'export'`? **No.** Intercepting routes are unsupported; the slot was
   deleted and the disclaimer is a full-page navigation.
2. Does the widened `generateStaticParams` set export cleanly, and how many files
   does `out/` contain against the 20,000-file cap? Current OpenNext build: 4,047
   files at 1,921 routes.

   **This inverted the sizing decision.** A static export writes ~10 files per
   route (Next 16's client segment cache emits `__next._tree.txt`,
   `__next._full.txt`, `__next._head.txt`, `__next._index.txt` and a per-segment
   `__PAGE__.txt` alongside the HTML) against OpenNext's ~2, and Next 16.2 exposes
   no config flag to disable it. The widened `LIST_DEPTH` of 60/30/8 measured
   3,714 routes → **36,819 files / 2.06 GB**, nearly double the cap. Cut to
   15/8/3: 1,037 routes → **10,302 files / 601 MB**, a ~38s build.

   Shrinking the prerender set is the right call here rather than a regression.
   Under OpenNext a tail id meant a full React render on the Worker, so the only
   defence was to prerender more. With a cheap, SEO-complete Worker fallback a
   tail id costs one TMDB fetch and an HTMLRewriter pass, so the size of the
   prerendered set no longer governs CPU at all.

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

- **Intercepting route** did not survive export (spike 1). The disclaimer is now
  a full-page navigation. Low impact, as expected.
- **Asset count** grows with the prerender set at ~10 files per route, so the 20k
  cap is the real ceiling on how many pages this site can have — roughly 2,000
  routes. Currently 10,302 files at 1,037 routes, ~half the cap. Anything that
  widens `LIST_DEPTH` must re-measure `find out -type f | wc -l` before deploying.
- **Tail pages are client-rendered for the body.** Unfurlers read only the head,
  which is injected, so they are unaffected. Googlebot executes JS. Other
  crawlers see the injected `<h1>` and overview but not the full cast list —
  accepted, because these ids are outside the indexed catalog by definition.
- **Two implementations of the same TMDB read** (Next services at build, Worker
  at runtime) could drift. Mitigated by having the Worker call the same TMDB URL
  shapes, and by `/api/media/:type/:id` returning the same payload the detail
  page props expect.
