# The search palette shifted on every keystroke

## What

PostHog field CLS for `/movies` on mobile was p75 0.809 (poor). Lighthouse sees 0 because it never opens
search. The worst sessions all used the header search: 0.6 to 4.9 reported on `/movies` and on the detail
pages they navigated to (web-vitals CLS accumulates over the whole page life).

Cause: `components/command-menu.tsx` rendered the All / Movies / TV chip row only while `status ===
'results'`. Typing goes results -> loading -> results, so the 41px row was removed and re-added per
keystroke and the list jumped down and up. `chipRowState` (lib/search-chip-row.ts) now reserves the row
(`invisible`) in idle, loading and results, and drops it only for a settled empty, failed or link outcome.

`pnpm cls:probe` (390x844 touch phone, keyboard-sized viewport, 700ms search latency, text typed as
`char` events like a soft keyboard) logs every layout shift with the moved nodes. Typing "dune" at 900ms
per letter: 0.617 -> 0.247. Load, scroll of the listing and opening the palette were already 0.

## Mistakes

- Assumed the shift was in the listing (infinite load, sticky filters) from the brief. The listing is
  0 at load and while scrolling; the trigger was in the sessions' event trail (`search_performed`).
- First probe typed with keyDown events and measured 0: real key events mark shifts as input-driven for
  500ms. An Android soft keyboard sends none, so the probe sends `char` only.
- First fix reserved the row only once a query existed; that moved the one shift to the first keystroke
  and measured worse at fast typing. Reserving from idle removed it.

## What worked

- Event trail of the worst sessions in PostHog, then a layout-shift observer that prints `sources`.

## Rules

- A control that is added and removed by async state needs its space held, not just its content.
- A layout-shift probe must not send keyDown, or it hides what soft keyboards cause.

Not fixed: a one-time 0.247 when the shortcuts group is replaced by results skeletons on the first
search; mobile INP on /movies (412ms) and /tv-shows/:id (410ms) not investigated.
