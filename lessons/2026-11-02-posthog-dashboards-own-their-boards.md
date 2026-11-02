# PostHog dashboards own their boards

## What

The Growth board showed "100,000 users" on DAU/WAU/MAU and a −52,000 "dormant"
week on Lifecycle: the August bot fleet, drawn as growth and then as churn. Rebuilt
all three boards from `scripts/posthog-dashboards.mjs`:

- Sections (one-line markdown cards) and sized tiles laid out in spec order on the
  12-column grid (`layoutTiles`), KPI rows with % change, a description on every tile.
- masareef's comparison tables ported (`scripts/posthog-comparisons.mjs`): totals
  and activity over 1/3/7/28 days, day-by-day vs the day and week before, running
  totals, and a GOOD/WATCH/BAD scoreboard on the weekly board.
- New tiles: top titles, genres, countries with play rate, acquisition by source and
  landing screen, new vs returning per day, days active, real-user web vitals.
- `--check` now runs Trends/Funnels/Retention too; 77 tiles, every one ran.

## Mistakes

- **Setup only added and updated.** The board had 37 hand-made tiles from before the
  spec existed, never removed, and they were the bad ones. The spec now owns each
  board: anything it does not name comes off.
- **The 2026-09-02 cut was only in `HUMANS`.** HogQL tiles were clean; Trends,
  Lifecycle and Retention used relative windows reaching into August. It is now a
  project test-account filter (`AFTER_BOT_BLOCK`), so it reaches hand-made insights too.
- **Assumed the filter change would show at once.** The board still drew the fleet
  after it was applied; PostHog was serving cached tile results. Confirmed with a
  direct TrendsQuery (DAU on 1 Sep: 15,303 unfiltered, 0 filtered), then pressed Refresh.
- **Merging an insight's dashboard list** put a tile the spec had moved straight back
  on its old board every run (one tile "taken off" forever). The spec now sets the
  full list.
- **HogQL charts without `chartSettings`** drew a 62-row line as one dot.
- **The `[managed…]` marker lived in the description**, so PostHog printed it under
  every tile title. Ownership is now "on a board the spec owns".
- Tried a two-row section card (dead space) and a one-row card with a second line
  (it scrolls) before settling on one heading line.

## What worked

- Probing the dashboard API on a throwaway board first (text tiles, layouts,
  `deleted: true`) before writing the sync.
- Copying masareef's comparison module as-is and swapping the events.

## Rules

- A spec that applies to a board must also remove what it does not name.
- A data cut-off belongs in the project test-account filter, not only in a HogQL macro.
- After changing project filters, refresh the dashboard before judging a tile.
