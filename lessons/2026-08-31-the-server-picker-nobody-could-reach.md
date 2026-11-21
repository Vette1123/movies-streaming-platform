# The server picker nobody could reach

**Date:** 2026-08-31
**Area:** playback — `hooks/use-stream-source.ts`, `components/details-hero.tsx`

## What

A supporter reported that changing the server did nothing: every title played
the house player, whatever they picked. Two independent bugs, both of them
supporter-only, which is why nothing else ever caught them:

1. **`prefs.source` was never read.** The Settings picker
   (`components/account/playback-panel.tsx`) writes the chosen server to the
   account via `savePrefs({ source })`, and `useStreamSource` resolved from
   per-title memory, then localStorage, then the tier default — the account
   field was not in that list at all. For a free account the result was merely
   inert; for a supporter the tier default is the house player, so the picker
   was visibly, permanently ignored.
2. **The in-player switcher was hidden in exactly the mode that needed it.**
   `DetailsHero` rendered `<SourceSwitcher>` under
   `isIframeShown && sourceControl && !useReely`. The house player IS `useReely`,
   so supporters — the only people who ever see the bar — got no bar. Settings
   was their only exit, and Settings was bug 1.

Fixes: the precedence now lives in one pure function, `resolveSourceId` in
`config/sources.ts` — per-title memory, then the account's Settings choice, then
this device's last switch (free accounts only), then the tier default — and the
switcher renders over the house player too. Seven cases pinned in
`tests/rich-source.test.ts`.

## Mistakes

- **Shipped a settings control whose value nothing read.** The write path was
  complete — optimistic store update, profile cache, POST to `/api/account` —
  and the read path did not exist. It looked correct in review from either end;
  only following the value from the button to the `<iframe src>` shows the gap.
  A preference is not implemented until something reads it.
- **Wrote "supporters always default to ours" as an unconditional return.** The
  comment in the hook argued it deliberately: stored server choices predated the
  player, so honouring them would pin supporters to an embed. True on the day it
  was written, and stale the moment Settings started offering the player as a
  choice — after which the same line was throwing away deliberate input. A guard
  justified by "the stored data is legacy" needs a date on it, because the data
  stops being legacy.
- **Hid a control with a boolean rather than asking what the control is for.**
  `!useReely` reads as "the bar is for embeds". The bar is for choosing a
  source, and the house player is a source.
- **Nearly verified the fix by clicking with `element.click()` from injected
  JS.** It silently did nothing on a page whose React had not attached handlers
  the way a real click needs — and the first attempt hit the wrong element
  entirely and navigated to /watchlist. A real `left_click` at the element's own
  coordinates (scaled: the screenshot is 1568px wide, the window 2560) is what
  actually exercised it.

## What worked

- Faking the tier locally instead of standing up an account: `document.cookie =
  'reely_account=1'` plus a `reely_profile` entry with `pro: true`. Dev has no
  `/api/auth/refresh`, so the refresh fails, `markFailed` leaves `signedIn`
  undefined, and `useAccountIdentity` falls back to the cached profile — a real
  supporter render with no D1 and no OAuth.
- Watching `localStorage` while clicking: `reely_stream_source_by_title` gained
  `movie:550` and `reely_stream_source` stayed null, which is the exact write
  contract the fix intends for a supporter (per-title memory, no new default).
- The dev environment proving the fallback for free: the house player cannot
  boot without the worker, so `onUnavailable` fired and the bar bounced back to
  the embed in front of us.

## Rules

- One pure function owns "which source plays" (`resolveSourceId`), and it is
  tested. Adding a new place a preference can come from means adding a line
  there, not a branch in a hook.
- Every setting must be traceable to the code that reads it, in the same change
  that adds the control.
- A control that only supporters can reach is a control nobody tests. Fake the
  tier and drive it before calling it done.
