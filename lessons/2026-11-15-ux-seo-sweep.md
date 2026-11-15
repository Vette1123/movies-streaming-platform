# App-wide UX, PostHog and SEO sweep

## What

A sweep across PostHog, the components and the SEO surfaces. What shipped:

- **Safari's null `localStorage`.** The only open PostHog issue was
  `null is not an object (evaluating 'window.localStorage.getItem')` in
  `hooks/use-hero-autoplay.ts`. It and `swiperIdentity` in `lib/match-night.ts` were the
  only two reads without a `try`. Both now use `lib/safe-storage.ts`.
- **Copy buttons claimed success on failure.** Six account panels ran
  `void navigator.clipboard?.writeText(x)` and then showed "Copied" anyway. With the API
  missing (http pages, in-app webviews) or refused, the button lied. `useShare` did the
  same: `?.` resolves to `undefined` and it toasted "copied". There is now one
  `copyText()` that returns whether the text landed (with an `execCommand` fallback for
  webviews) and one `useCopy()` hook. The hook only shows "Copied" when the copy worked,
  shows an error toast when it didn't, clears its timer on unmount, and only tracks the
  `shared`/`calendar` events on success. The two icon-only buttons gained an sr-only
  status. The profile Copy and Open buttons no longer render with a null URL (`href="#"`).
- **Tap targets.** Star ratings (18px → 24px with a focus ring), "Show again" (11px text →
  `tap-target`, plus a per-title aria-label), saved-filter preset and save buttons, filter
  chips and "Clear all". The preset name input got a label.
- **Tail-id JSON-LD parity.** The Worker built its own Movie/TVSeries object and it had
  drifted from `lib/structured-data.tsx`: a TVSeries carried `datePublished` instead of
  `startDate`, with no `@id` and no `inLanguage`, on the ~13,900 tail URLs. The Worker
  now calls `tailTitleJsonLd` in `lib/json-ld.ts`, and `tests/tail-json-ld.test.ts`
  compares its output with the prerendered builders. Tail pages also gained
  `twitter:image:alt` and `video:release_date`, and Movies gained `dateCreated`. The
  one-crumb BreadcrumbList on the homepage is gone.

## Mistakes

- **Two "issues" in the usage report were not product bugs.** "Library reach fell 42% →
  29%" is just `watch_history_added` following plays. Plays fell 32-42/day → 15-23/day
  from 2026-11-10, but per-person conversion did not change (mobile stayed about 50% of
  detail visitors). Mobile *traffic* dropped about 40% that day. Meanwhile a new desktop
  fleet started inflating the denominators: Chrome 154 on Windows, 1920x1080 screens,
  randomised inner windows, US IPs with Paris/Jakarta/Saigon timezones, about 5 events
  each and zero plays. I nearly fingerprinted it on a geo/timezone mismatch, but over 30
  days the mismatch cohort includes VPN users who play (3-6 plays per group), so it is
  not blocked.
- **The `/tv-shows/:id` "frustration hotspot" was mostly single clicks.** The repeated
  `group/ep` dead clicks were on unaired episodes, which have no play button by design.
- **The audit's keyboard finding on the trailer overlay was wrong.** That overlay is
  `TouchFullscreenControls`; desktop gets `DesktopFullscreenControls`, which has a
  labelled Play/Pause button. No change made.
- **I almost reformatted another session's file.** `scripts/library-ingest.mjs` fails
  `prettier:check` on main, but another session has uncommitted edits to it in the main
  checkout. I reverted my format of it.

## What worked

- Reading `posthog:usage`'s WHAT TO DO lines as leads, not verdicts, and splitting by
  device before believing a funnel.
- Replacing the Worker's hand-rolled node with one pure builder, plus a test that
  compares it with the baked builder, instead of patching three fields in place.

## Rules

- A second hand-written copy of a schema node drifts. Build both from one function, or
  pin them together with a parity test.
- A copy button shows success only after the clipboard write resolves.
- Before blocking a fleet on a heuristic, measure the same heuristic over 30 days against
  people who play.
