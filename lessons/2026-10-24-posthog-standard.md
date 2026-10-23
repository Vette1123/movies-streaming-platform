# PostHog to the masareef/rafiq standard

**Date:** 2026-10-24

## What

PostHog had 45 typed events and one 37-tile dashboard of vanity counts, none of which
filtered test accounts. Brought it to the setup masareef and rafiq run, and wrote that
setup down once as `~/.claude/rules/posthog.md` so the next project starts there.

- **Client**: `track()` typed to `EVENTS`, `area` on every event (`satisfies` table),
  `route` template + visit super properties, `first_play` / `first_core_use` derived in
  `track()`, `identify(userId)` + `signed_in`/`supporter` traits, `stream_source` on every
  play, per-flow `$exception_fingerprint` on `api_error`.
- **Coverage**: 11 new event kinds and `feature_used` across 23 features, wired at choke
  points (`savePrefs`, `useShare`, `signOut`, retry buttons) plus ~40 handlers; ~20
  swallowed catches now call `trackApiError`.
- **Scripts**: shared `scripts/lib/posthog.mjs`, `posthog:issues`, `posthog:usage`,
  `posthog:setup` (3 dashboards / 37 tiles, 3 alerts, project settings, test filter on 40
  old insights), deploy annotation in `cf-deploy.mjs`.

## Mistakes

- **`errors:triage` had no LIMIT on its HogQL.** HogQL stops at 100 rows silently, so past
  100 distinct messages it would read live errors as dead and `--apply` would close their
  GitHub issues. Found only because the second copy of the query loop moved onto the
  shared runner, which throws on `hasMore`.
- **HogQL returns array properties as JSON text.** The first board printed
  `["Error"]: ["Minified React…"]` and no stack frames; `$exception_types` and
  `$exception_list` arrive as strings. `parseJsonish` in `board-filters.mjs`.
- **The coverage test's first version flagged `image_host_fallback` as dead.** It looked
  for `trackX(`; that helper is passed as a callback. Now: strip imports, then any
  reference counts. It was seen red before it was trusted.
- **Planned per-server failure rate on `media_played.source` — the property does not
  exist.** `PlayButton` cannot see the server; registering `stream_source` as a super
  property from `useStreamSource` gives every play the server without plumbing.
- **A "new visitors by source" tile filtered on `visit_n = 1`**, a property this same
  change introduces, so it read empty. `--check` caught it; it now uses first-seen time.

## What worked

- `posthog:setup --check` before calling a dashboard done: 22 HogQL tiles run on live
  data, empty and all-null columns named. The remaining empty ones (`visit_n`, `area`,
  `first_play`) are the properties this deploy starts sending.
- Upserting by name with a `[managed by pnpm posthog:setup]` marker: the second run
  created 0 and updated 37.
- Alert subscriber from an insight's `created_by` instead of asking for `user:read`.
- Real-browser check of the milestone path: a cleared browser latched `first_play` and
  `first_core_use` on its first Watch Now; a browser with history was `seeded` and fired
  nothing.

## Rules

- Any HogQL that decides something has an explicit LIMIT, and goes through `runQuery`.
- A tile reading a property this change introduces is checked again after the deploy.
- New feature → one `FEATURE_AREA` line + `trackFeatureUsed`; new fetch → `trackApiError`
  in its catch. The coverage test enforces the first half.
