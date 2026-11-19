# Four animations that were quietly broken

## What

An animation audit (code read against the improve-animations bar, then a live
touch-swipe probe on a 390 px phone) with one rule from the owner: keep every
animation exactly as designed, fix only what is broken.

| Animation              | What was broken                                                                                                                                                                                                                                                                                                 | Fix                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Hero Ken Burns push-in | Not running for anyone since 21 Oct. `b64dfe3` restored it but put `@keyframes hero-kenburns` inside `@media (prefers-reduced-motion: reduce)`, so it only existed for people who asked for less motion, and `motion-reduce:animate-none` switches it off for them. Live: animation-name set, transform `none`. | Keyframes moved into `@theme` beside the others; pinned by `tests/hero-motion.test.ts`. |
| Hero swipe             | Only the active slide carried the zoom, so on release the arriving slide jumped 1 -> 1.05 and the leaving one fell back to 1 while still in view.                                                                                                                                                               | `lib/hero-motion` `kenBurnsClass`: neighbours carry it paused.                          |
| Match Night card throw | A card flew off the way the PREVIOUS decision went. Live: thrown left after a like, it travelled to x=+520. A removed card keeps its last props, so `exit` read the stale direction.                                                                                                                            | `custom={exitDirection}` on AnimatePresence + an `exit` variant function (`cardExit`).  |
| Hero arrows (desktop)  | `transition-all duration-300` eased every frame framer wrote, so hover/tap lagged; CSS `hover:scale-105` stacked on framer's scale; the CSS opacity classes were dead (framer's inline opacity wins).                                                                                                           | Framer owns the motion; dead and fighting classes removed. Same look.                   |

Also: the lg poster panel's `transition-all` became `transition-[opacity,filter]`.

Verified fine and left alone: hero swipe follows the finger and settles (no
long frames at 4x CPU), touch hover is gated by Tailwind 4's `(hover:hover)`,
timers and listeners are cleaned up, no autoplay by design (`autoPlay={false}`).

Cost of the zoom, measured on live after the fix (390 px, 4x CPU, a capable-
phone profile, one swipe per run): frames over 300 ms were 0 in 5 swipes with
the zoom running and 1 in 5 with it forced off; the slow frames that do occur
are React work (MessagePort.onmessage) or unattributed, with 22-38 ms of
render and layout, so not the zoom.

## Mistakes

- The October fix was checked by reading the diff, not by looking at a
  running hero, so the misplaced keyframes shipped and stayed a month.
- The audit's first suspect list included the carousel progress pill; the hero
  has autoplay off, so the pill never renders. Check the call site's props
  before ranking a component's bug.
- The first live probe read the active slide at scale 1 and blamed headless
  Chrome's low-power detection. Overriding cores and memory changed nothing;
  reading `animationName` next to `transform` showed the keyframes were missing.
- Ran the tests, THEN Prettier. Prettier wrapped the exit arrow onto two lines,
  the source check matched one line only, and CI failed the first deploy.
  Format first, test last.

## What worked

- A live probe that reads computed styles mid-gesture (`touchMove` held,
  `getComputedStyle(img).transform`) and samples the thrown card's x every
  frame. Both failed on live before the fix.
- Answering `/api/match/*` inside the probe, so testing the deck wrote nothing
  to production.

## Rules

- Keyframes live in `@theme` (or top level), never only inside a
  `prefers-reduced-motion` block; the reduced block may only redefine them.
- An exit that depends on how the element left takes its value through
  AnimatePresence `custom`, never through the leaving element's props.
- An element framer animates gets no CSS `transition-*` on the same properties.
