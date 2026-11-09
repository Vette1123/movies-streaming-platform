# The image-host alert was the square-screen fleet, moved past square

Date: 2026-11-09

## What

`Spike — image host down for more than 15 people a day` fired: 17 people on
2026-11-08, up from ~4/day. wsrv.nl answered 200 throughout. 42 of the 43
people behind the last four days had the same six events (one detail
pageview, `media_detail_viewed`, `image_host_fallback`, `$set`) and no
interaction, on desktop Chrome with screens like 1166x1247 and 1204x1359:
the anti-detect farm `isSquareScreenFleet` caught at height/width 0.85-0.95,
now randomising to 1.05-1.16. Over 30 days that band was 75 people, 1
interacting; real portrait/tablet-sized desktop screens start at 1.25 and play.

Fix: band widened to 0.85-1.2 in `SQUARE_FLEET_RATIO` (client gate) and in
`NOT_FLEET` (HogQL history + project test-account filter, pushed with
`pnpm posthog:setup`). Yesterday's alert value re-reads as 8.

## Mistakes

- No wrong turn; the note in `lib/posthog-client.ts` (94% of breaker trips were
  the last fleet) pointed straight at it. The gap it exposed: the client band
  and the HogQL band were two literals with nothing tying them, so widening one
  could silently miss the other. A test now pins them together.

## What worked

- Bucketing desktop events by rounded height/width with an "interacted"
  column: the fleet band and the human bands separate cleanly.

## Rules

- When the image-host alert fires, check for "6 events per person, zero
  interaction" before suspecting wsrv. ~12/day of the same pattern remains on
  stock 1920x1080 with no screen tell; if the alert re-fires on that alone,
  require an interaction in the alert query rather than adding a screen rule.
