# Search and the mobile menu paint before their body

## What

Search Console still rates every mobile URL Poor on INP (> 500 ms) five days after the Watch Now
fix (#182). PostHog split the two questions:

- Watch Now itself is fixed: mobile p75 312 ms (n=259) before 11 Nov, 216 ms (n=21) after,
  processing 66 → 15 ms. CrUX is a 28-day window, so Search Console shows it around 9 Dec.
- The rest of the slow taps since the fix are spread thin. The largest group is the header
  search button (`button…2xl:w-64` and its `span.truncate` label): 10 of ~30 slow taps, processing
  114–261 ms, mostly on `/`, `/movies` and genre pages. Next is the mobile menu icon (556–824 ms).

Both opened a Radix dialog and built the whole body in the tap: cmdk registering every recent
search, shortcut and companion app; the drawer's nav, support, account, apps and social sections.
`usePaintedOpen(open)` (hooks/) is true one paint after the dialog opens. The body waits for it,
under the open animation. The search input still mounts in the tap, because iOS only raises the
keyboard for a focus made inside the gesture. `afterNextPaint` now returns a cancel, so a dialog
closed before its first paint never fills its body.

## Mistakes

- Read "overall mobile p75 352 ms after, 318 before" as "the Watch Now fix did nothing". Split by
  target, the fixed control had improved. The overall number is now made of other controls.
- First plan was to defer `setOpen` the way Watch Now defers playback. That breaks the iOS keyboard
  for search. Defer the body, never the focus.
- A local `/api/search` answers 404 under `next dev`: the Worker serves it. "Search didn't answer"
  in dev is not a regression.

## What worked

- One HogQL query, grouped by `interactionTarget` with input delay, processing and presentation
  averages, split at the fix's merge time.
- Checking in the dev server at desktop width: focus in the input, 9 items one frame later, the
  drawer's 8 nav links and all sections after opening it through its trigger.

## Rules

- Measure a fix against its own target. The overall p75 mixes in everything else.
- A dialog with a heavy body opens its shell in the tap and fills the body after the paint
  (`usePaintedOpen`). Anything needing focus stays in the tap.
