---
paths:
  - 'lib/analytics-context.ts'
  - 'lib/analytics.ts'
  - 'components/analytics/not-found-tracker.tsx'
  - 'scripts/posthog-comparisons.mjs'
  - 'scripts/posthog-dashboards.mjs'
  - 'scripts/posthog-fixed.json'
  - 'scripts/posthog-issues.mjs'
  - 'scripts/posthog-query.mjs'
  - 'scripts/posthog-setup.mjs'
  - 'scripts/posthog-usage.mjs'
  - 'scripts/lib/posthog-insights.mjs'
  - 'scripts/lib/posthog.mjs'
  - 'tests/analytics-context.test.ts'
  - 'tests/analytics-coverage.test.ts'
  - 'tests/analytics-route.test.ts'
  - 'tests/pwa-analytics.test.ts'
---

### Analytics

PostHog **client-side only** — all events centralized in `lib/analytics.ts`. Server-side capture (`instrumentation.ts`, `lib/posthog-server.ts`) is deleted: there is no server left to throw. Source maps are uploaded to PostHog at build time via `withPostHogConfig` (gated on `POSTHOG_API_KEY` + CI) so minified prod stack traces symbolicate.

- **Follows the cross-project standard** in `~/.claude/rules/posthog.md`. `track()` is typed to `EVENTS`, stamps `area` (`EVENT_AREA` — a new event without one does not compile), advances the visit counter and derives `first_play` / `first_core_use` (`lib/analytics-context.ts`). The long tail is `trackFeatureUsed({feature, action, outcome})` with `FEATURE_AREA`; prefs, shares and retries report from their single choke points (`savePrefs`, `useShare`, the retry buttons). `tests/analytics-coverage.test.ts` fails on an event nothing calls.
- **A new feature adds a `FEATURE_AREA` line and a `trackFeatureUsed` call; a swallowed `catch` on a real fetch calls `trackApiError`** (`expected: true` for network failures, which skips the Error Tracking issue).
- `pnpm posthog:issues` (error board + `gate`), `pnpm posthog:usage` (reach by area, funnels, WHAT TO DO), `pnpm posthog:setup` (applies `scripts/posthog-dashboards.mjs`: the three dashboards, alerts, project settings — idempotent; `--check` runs every HogQL tile on real data). Every deploy posts a PostHog annotation.
