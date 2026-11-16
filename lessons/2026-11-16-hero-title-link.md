# The hero title opens the title, and a mouse swipe never navigates

## What

A PostHog sweep (errors, usage, rage and dead clicks, last 7 days) found one real UX gap:

- **The hero wordmark was dead.** One viewer clicked it 16 times in a week. It was plain
  text on purpose: a link is natively draggable, and pressing one picked up a ghost instead
  of swiping. But the carousel has since started cancelling `dragstart` on the whole stage,
  and it routes touch taps on any `a[href]` itself, so that reason no longer held. The title
  is now a `MediaLink` to the detail page, and `hero_watch_clicked` carries
  `target: 'button' | 'title'` so its use shows up.
- **A mouse swipe could navigate.** During a drag the track follows the cursor, so a swipe
  that starts on a link also ends on it, and the browser clicks it. That was already true of
  Watch Now; the title made the grab area far bigger. `isSwipeClick` (`lib/tap-slop.ts`) and
  a click-capture on the stage swallow a pointer click that travelled past `TAP_SLOP`.
  `detail === 0` clicks (keyboard, the carousel's own touch `el.click()`) always act.

Everything else on the board was not a product bug:

- The open `localStorage` issue fired at 10:59 on 2026-11-15, before #204 merged at 15:21.
- The 7 `react_query` errors were one viewer's "Failed to fetch"; `/api/season-details` for
  tv/279246 answers 200 from the edge cache.
- "vidlink.pro 50% failures" was one viewer's 3 stalls on a just-aired episode.
- The other dead clicks were the already-selected season tab, the disabled Reely Beta row
  (it explains why), and a desktop detail backdrop.

## Mistakes

- Took the hero's "the title is NOT a link" comment as still binding. The constraint it
  described had been removed elsewhere (the stage-wide `dragstart` cancel); read the code
  the comment depends on, not just the comment.
- Read the browser's screenshot coordinates as CSS pixels when probing `elementFromPoint`
  (2560px viewport, 1568px screenshot frame) and briefly thought the click had missed.
  It had landed; the dev server was compiling the detail route.

## What worked

- Pulling the full `elements_chain` through `runQuery` directly. `posthog:query`'s table
  truncates long cells, which hid which image and which button were dead-clicked.

## Rules

- A click handler on anything inside a draggable track must tell a swipe's click from a tap.
- `detail === 0` is the marker for keyboard and synthetic clicks; never swallow those.
