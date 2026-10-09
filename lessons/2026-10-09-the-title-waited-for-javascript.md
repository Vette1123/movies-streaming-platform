# The title waited for JavaScript

## What

The hero's title wordmark ("CARRIE") appeared late. Measured on production:
slide 0's logo is preloaded and arrives in ~150ms, but the server HTML shipped
the `<img>` at `opacity-0 blur-[2px] translate-y-2`, and only React's
`logoLoaded` state (set in `onLoad`, i.e. after hydration) turned it visible,
followed by a 700ms fade. The text title was held hidden in the meantime too,
so the slot sat empty for the whole hydration on top of the download. Off-stage
slides were worse: their logos were `loading="lazy"` and only started
downloading as the slide came in (2.1s on the measured load).

Fixed:

- The wordmark has no opacity gate. It paints the moment the browser decodes
  it, before hydration. `lib/hero-title.ts` decides only whether the TEXT
  fallback is up; `tests/hero-title.test.ts` pins that the logo is visible
  while `logoLoaded` is still false.
- The text fades in only as a fallback and leaves instantly when the logo
  lands, so the two never overlap.
- The slides parked either side switch their logo to `eager` once the page
  has loaded (`onIdleAfterLoad`), so a swipe lands on a painted wordmark.
  Still lazy before `load`, which keeps them off the LCP's back.

## Mistakes

- A crossfade built to avoid a text-to-logo "pop" became a gate on JS. The
  previous fixes in this file (the `ref` callback catching `img.complete`, the
  2.2s grace, `firstPaintSettled`) each patched a symptom of making a native
  image's visibility depend on React state. The root fix was to stop doing that.
- The transition (blur + translate + 700ms) was polish that read as slowness.

## What worked

- Measuring the resource timing first: the bytes were never the problem
  (150ms); the visibility was.

## Rules

- Never gate a server-rendered image's visibility on hydration. Let `<img>`
  paint itself; use JS only for fallbacks.
- Lazy is right before `load`, wrong after it for anything one swipe away.
