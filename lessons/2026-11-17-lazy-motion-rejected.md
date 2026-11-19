# LazyMotion: built, measured, reverted

## What

Tried cutting first-load JS by switching framer-motion to `LazyMotion` (strict,
`domMax` loaded by dynamic import) and all seven `motion.*` components to `m.*`.
Animations unchanged. Measured on a local `pnpm build:cf`, the script files
each page's HTML references, brotli:

| Page             | Before   | After    | Saved   |
| ---------------- | -------- | -------- | ------- |
| `/`              | 325.6 KB | 311.3 KB | 14.3 KB |
| `/movies/27205`  | 342.3 KB | 315.5 KB | 26.8 KB |
| `/tv-shows/1396` | 351.5 KB | 324.7 KB | 26.8 KB |

Under the 30 KB bar set before starting, so it was reverted. Nothing shipped.

Second attempt, the split the Rules named: `LazyMotion` strict with
`domAnimation` app-wide, a nested `domMax` boundary (dynamic import) around
only the carousel and swipe deck, all seven components on `m.*`. Local
`pnpm build:cf`, brotli. "Downloaded" is every .js file a 390x844 headless
Chrome requested in 10 s, cache off.

| Page             | Referenced before | after    | Downloaded before | after    |
| ---------------- | ----------------- | -------- | ----------------- | -------- |
| `/`              | 325.6 KB          | 311.4 KB | 308.6 KB          | 323.9 KB |
| `/movies/27205`  | 342.3 KB          | 315.5 KB | 356.6 KB          | 345.5 KB |
| `/tv-shows/1396` | 351.5 KB          | 324.8 KB | 359.4 KB          | 354.7 KB |

Lighthouse mobile, 5 runs on `/` served locally: median 62 before (60 62 66 62
59), 57 after (57 57 61 56 56); TBT up from ~200 ms to ~340 ms. Both bars
missed (downloaded JS on `/` rose 15 KB, score fell 5), so it was reverted.

## Mistakes

- Expected the whole ~62 KB framer chunk to leave first load. The carousel and
  swipe deck drag, so they need `domMax`, and that 62 KB chunk still downloads
  right after hydration on every visit. Only the parse moved, not the bytes.
- Split attempt: the home hero is a Carousel, so `domMax` loads on `/` anyway,
  on top of `domAnimation`. Two bundles instead of one, and the carousel also
  waits on the second dynamic import before it can drag.
- Turbopack re-split the other shared chunks and ate part of the saving.

## What worked

- Setting the ship bar (>= 30 KB on `/`) before building made the revert a
  non-decision.

## Rules

- Don't retry LazyMotion in any form while the home page hero drags: both
  variants are measured and neither wins. Only a hero without framer drag
  (native scroll-snap, or a hand-rolled pointer drag) makes `domAnimation`
  alone possible on `/`.
- framer-motion stays (the user's decision, 17 Nov).
