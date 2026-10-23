# The register that never landed, and the fourth fleet

**Date:** 2026-10-24

## What

Followed the PostHog error board to zero and checked the new usage report's numbers.
Three fixes came out of it, and two of them were bigger than any open error.

- **Super properties were being dropped for almost everyone.** `ph()` replayed its
  queue the moment posthog-js finished importing, but `init()` ran after that. Every
  `register()` made during page load hit an uninitialised instance and was lost. Over
  one week, 830 of ~840 people had no `app_version` on any event. Every super property
  added the day before (`route`, `visit_n`, `signed_in`, `supporter`, `stream_source`)
  would have gone the same way.
  - Fix: `setPostHogInitializer`. The loader now runs `init` before it replays the queue.
  - This also fixes the error boundaries, which loaded posthog-js and never initialised
    it when a crash came before the idle init.
- **A fourth bot fleet was about two thirds of "people".** It uses desktop screens with
  height/width 0.85-0.95. Over 14 days that was 976 people and 0 plays. Weekly people
  dropped from 788 to 262 once it was excluded, and activation rose from 13% to 43%.
  - It is dropped client-side by `isSquareScreenFleet`.
  - Past data is cleaned by `NOT_FLEET`, which `{humans}` uses and which is now in the
    project's test-account filter.
- **The error board is at zero.**
  - React #482 and "Transition was skipped" were already fixed, and their last events
    came before the fix commits. Both are resolved and recorded in the ledger.
  - The `insertBefore` NotFoundError is now in `lib/error-noise.ts`, and the issue is
    suppressed.
  - The `buttonVariants` TypeError is resolved as a stale-deploy chunk mix.
  - The September `/api/filter` 500 is resolved as a single event.
  - GitHub issues #113 and #114 are closed.
- `pnpm dev:stop` kills every server this checkout started and proves the ports are free.

## Mistakes

- **Read the `dev` app_version as a build problem first.** I spent several queries on CI
  env mapping and turbopack inlining. The live chunk had the right SHA all along. The
  question that cracked it was "how many events have no app_version at all": 93% of
  them. Ask what is missing before asking what is wrong.
- **Trusted yesterday's headline numbers.** "13% of 786 new visitors played" went into
  the report as the biggest lever. Two thirds of those visitors were a fleet. Every
  aggregate needs the "does this cluster ever do the core action" check
  (`uniqIf(person_id, event='media_played')` by screen, country and browser) before it
  is quoted.
- **Read "94% of image_host_fallback people acted" as proof they were human.** "Acted"
  included `media_detail_viewed`, which a bot fires just by loading a page. Use the
  conversion event, not "any event".
- **Left a Next server listening.** `TaskStop` ends the `pnpm dev` wrapper, but
  `start-server.js` keeps :3000. That is how the first session landed on :3001.
- **The usage report called 124 clicks by two people a hotspot.** Rules now count
  people, and the rule has a test.

## What worked

- Measuring the bad case before fixing it: a red/green test of the queue order (red on
  the old loader, green on the new one), then the fleet table by aspect ratio. Real
  desktops sit at 0.55-0.75 and play; the 0.85-0.95 band never plays.
- A Trends query with and without `filterTestAccounts` proved the hogql filter is
  valid and showed its effect (788 → 262) in a single call.
- Reproducing the "rageclicked" accordions and popovers in a browser before touching
  them. They work; that was two people clicking fast.

## Rules

- `register()` and everything else queued for posthog-js run after `init()`, never
  before. `tests/posthog-client.test.ts` pins the order.
- Before quoting a PostHog number, check whether the cohort behind it ever converts.
- After any browser test, run `pnpm dev:stop`.
