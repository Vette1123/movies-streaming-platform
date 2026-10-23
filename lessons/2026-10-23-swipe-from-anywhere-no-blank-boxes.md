# Swipe from anywhere, no blank boxes

## What

- **Hero swipe.** Pressing the title or synopsis on the home hero did not
  swipe. Both were links (`MediaLink`), and links and images are natively
  draggable. `user-select: none` does not stop that. The browser picked up a
  ghost of the link, cancelled the pointer, and framer's drag never started.
  The title and synopsis are plain text now. The track cancels `dragstart`
  for everything on it. Only the buttons (Watch Now, Trailer, Save, arrows,
  dots) and the genre chips click.
- **Missing images.** Crew and cast with no headshot rendered a grey slab.
  `/people` passed an empty `src`, which is a broken image. `/person/[id]`
  used a film-poster fallback for a person. The taste picker and profile list
  thumbnails were flat boxes.
  - `PersonPortraitFallback` shows initials on a tint picked from the name.
  - `MediaPosterFallback` keeps its glyph and title on a tinted gradient.
  - `lib/monogram.ts` owns both. It is static: no animation, no layer.
- **App icons.** The command menu, header popover and drawer showed one phone
  glyph for all three apps. The real launcher icons now come from the apps'
  own Expo projects via `pnpm apps:icons`.
- **PostHog.**
  - Exceptions are at zero for 48h.
  - The view-transition `AbortError` predates the 10-20 guard.
  - TV details LCP rose (desktop p50 904 → 2700ms). 16 of 53 samples are one
    user on one show, and movie pages share every candidate change and stayed
    flat, so this is a watch, not a fix.

## Mistakes

- **The hue palette.** The first `tintHue` was `hash*31 % 360` over the full
  wheel. In the browser, Matt O'Brien and Tracy King came out the same purple,
  side by side. The unit test passed because 3 distinct numbers is not 3
  distinct colours. Now it picks from 8 hues spaced for a dark card,
  FNV-1a-mixed.
- **The title link.** It was added on purpose, after PostHog showed dead
  clicks on it. On a stage whose primary gesture is a drag, that traded a
  swipe that always worked for a click that sometimes did.

## What worked

- A real `left_click_drag` that starts on the wordmark, checked against the
  slide counter (1/10 → 2/10, URL unchanged). This proves the gesture, not
  just the DOM.
- Finding the exact page from the user's screenshot (crew names → TMDB search
  → /tv-shows/32415) instead of eyeballing a page that had every photo.

## Rules

- Anything on a draggable stage that is a link or an image must have native
  drag cancelled at the stage.
- A colour helper is checked by looking at it, not by counting distinct
  numbers.
