# The 404-landing fleet's history, Next 16.4.6

## What

`posthog:usage` said reach fell in every area at once (playback 47% → 17%,
detail 85% → 44%). Nothing broke: the 404-landing fleet from this morning
(lessons/2026-11-17-error-landing-fleet.md) put 291 "people" into today's
denominator. The client gate stopped new visits at ~14:00 UTC, but the events
already sent still passed `{humans}`. `NOT_ERROR_LANDING_FLEET` in
`scripts/lib/posthog.mjs` drops them by their signature (04:00–14:00 UTC,
desktop Chrome, direct, Linux 1536×960 or Windows 1920×1080). It is in
`{humans}` and the project's test-account filter (`posthog:setup` applied,
`--check` ran every tile). Today's people went from 314 to 22.

Next 16.4.4 → 16.4.6 fixes the moderate `use cache` / `unstable_cache`
information-disclosure advisory; `pnpm audit --prod` is clean.

## Mistakes

- The gate this morning covered the future and left the past in every
  dashboard. A fleet fix has two halves: the client gate and the history filter.

## What worked

- Grouping the window by OS × browser × screen × referrer: two buckets held 291
  people and zero clicks, and no real visitor shared them.

## Rules

- A fleet gate ships with a dated `{humans}` exclusion for what it already sent.
