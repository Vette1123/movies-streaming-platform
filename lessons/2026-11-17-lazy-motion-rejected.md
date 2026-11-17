# LazyMotion: built, measured, reverted

## What
Tried cutting first-load JS by switching framer-motion to `LazyMotion` (strict,
`domMax` loaded by dynamic import) and all seven `motion.*` components to `m.*`.
Animations unchanged. Measured on a local `pnpm build:cf`, the script files
each page's HTML references, brotli:

| Page | Before | After | Saved |
|---|---|---|---|
| `/` | 325.6 KB | 311.3 KB | 14.3 KB |
| `/movies/27205` | 342.3 KB | 315.5 KB | 26.8 KB |
| `/tv-shows/1396` | 351.5 KB | 324.7 KB | 26.8 KB |

Under the 30 KB bar set before starting, so it was reverted. Nothing shipped.

## Mistakes
- Expected the whole ~62 KB framer chunk to leave first load. The carousel and
  swipe deck drag, so they need `domMax`, and that 62 KB chunk still downloads
  right after hydration on every visit. Only the parse moved, not the bytes.
- Turbopack re-split the other shared chunks and ate part of the saving.

## What worked
- Setting the ship bar (>= 30 KB on `/`) before building made the revert a
  non-decision.

## Rules
- Don't retry LazyMotion with `domMax` for bytes. The only version worth
  measuring is `domAnimation` everywhere with a separate `domMax` boundary
  around the carousel and swipe deck, judged by a real mobile Lighthouse run.
- framer-motion stays (the user's decision, 17 Nov).
