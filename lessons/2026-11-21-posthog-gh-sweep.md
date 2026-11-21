# PostHog + GitHub sweep: a truncated tile and three stale issues

## What

- `posthog:setup --check` failed "Reach by product area": 15 named areas plus events with no area
  = 16 breakdown values against the hard-coded `breakdown_limit: 15`, so PostHog returned `hasMore`.
  `trends()` now takes `breakdownLimit` (default 15); the tile sets 25. Check: 16 series, ok.
- GitHub #203 (localStorage TypeError) and #194 (CefSharp link-scanner rejection) were already fixed
  (#204 safe-storage; lib/error-noise.ts) and resolved in PostHog; only the mirrored GitHub issues were
  left open. Closed with the evidence.
- #240 relay canary: 3/3 titles vault-degraded (segment 429 from the mbVault CDN to the runner) at
  02:25. A local `pnpm relay:canary` passed 3/3; a dispatched workflow run passed and closed it.
- PostHog error board: 0 open; gate passes with autocapture on.

## Mistakes

- None in the fix. The GitHub mirrors of resolved PostHog issues sat open for a week because
  resolving in PostHog does not close the GitHub issue.

## What worked

- `--check` runs every tile on real data; the error text names the fix ("raise the LIMIT").

## Rules

- After `posthog:issues resolve`, close the matching `app/posthog-eu` GitHub issue in the same step.
