# Eyeball 5xx gates on a rate, and stalls have a before/after query

## What

- `pnpm cf:health` failed on 1×503 of 179,363 eyeball requests. The rule is now
  `eyeball5xxGrade` (`scripts/lib/eyeball-5xx.mjs`): any 5xx warns, and it fails
  only at ≥ 0.05% AND ≥ 10 failures. `tests/eyeball-5xx.test.ts` pins both
  directions.
- `pnpm posthog:query --stalls`: boot stalls per session by day since
  2026-11-04, with anonymous, auto-hopped, stalled-again, trial and sign-in
  counts, to judge #184 once it has a few days of data.

## Mistakes

- The gate was `failures === 0` from the day it was written, and the last
  report called its red "noise" rather than fixing it. A check that is red and
  explained away has already stopped being read.
- The baseline query showed 1 automatic hop in 40 stalled sessions over 8
  days, from the one signed-in viewer. The pre-#184 numbers were already
  available, but nobody had queried them per session.

## What worked

- Copying the `crawler-403.mjs` pattern: a pure helper under `scripts/lib/`
  that returns the `grade()` shape, tested from vitest.

## Rules

- A health gate fails on a rate with a count floor, never on "any". It still
  shows the single event as a warning.
- A behaviour change that needs data to judge ships with the query that
  judges it.
