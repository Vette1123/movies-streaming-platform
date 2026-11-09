# Trailing slashes 301, no JSON-LD search template

## What

The sister downloader site's Search Console sweep turned up two problems, and Reely shared both.

- **Trailing slashes:** Cloudflare Static Assets answers `/movies/` with a 307 to `/movies`. A 307 is a temporary redirect, so a link posted with a slash never consolidates onto the canonical URL. `public/_redirects` now 301s every depth up to 4 segments; the deepest route is 3. This was verified under `wrangler dev` on the existing build: query strings are kept, `/` and the slashless pages still return 200, and the Worker-first `/lists/` also 301s.
- **JSON-LD:** `websiteJsonLd` carried a `SearchAction` with `urlTemplate: /movies?search={search_term_string}`. Google retired the sitelinks search box in 2024 and crawls such templates as literal URLs; the downloader's Search Console listed them as pages. It is removed. The dead `siteConfig.structuredData` block, read by nothing, is gone too.

## Mistakes

- None in the work itself. One cost: the isolation guard refuses `git show … > "$CLAUDE_JOB_DIR/…"`, so the red/green copies had to sit inside the worktree as `*.tmp` files, deleted after.

## What worked

- Testing `_redirects` placeholder rules on a copy of main's `out/` and `.cloudflare/` under `wrangler dev`, with no rebuild needed.

## Rules

- `_redirects` runs before `run_worker_first`, so a slash rule also catches `/api/x/`. No client sends one; keep it that way.
- `tests/trailing-slash-redirects.test.ts` walks `app/` and fails if a route is deeper than the deepest slash rule. `tests/jsonld-no-templates.test.ts` fails on any `{` in a site-wide JSON-LD URL.
