# The slab in front of the page

## What

"Details page is flashy: I see blank, then the actual content." Production
filmstrips (headless Chrome screencast, 1440x900) showed three separate
causes:

- **Client navigation** (homepage card → detail): ~0.9s of `loading.tsx`, a
  grey 80dvh rounded slab that looks like nothing on the page that replaces
  it. Then the page arrived with a dark hero, then a blurred one.
- **Hard load:** text over an empty dark hero at 1.27s, a smear at 1.57s, the
  picture at 2.2s. The smear was the image *already downloaded*, held at
  `blur-lg` and eased sharp over 700ms by BlurredImage's `intro` branch.
- **Tail ids** (the Worker's fallback shell): a pulsing full-height slab until
  `/api/media` answered.

What changed:

- The detail routes' `loading.tsx` is gone. A click keeps the current page up
  until the next is ready, which on a prefetched route is no time at all.
  Every detail link (`MediaLink`) carries `LinkPendingBar`: `useLinkStatus`
  draws a 2px accent bar at the top of the viewport, after a 150ms CSS delay,
  so fast navigations show nothing.
- The hero picture is fetched before the hero exists. `preloadHeroImage`
  issues React 19's `preload()` with exactly the AVIF `imagesrcset`/`sizes`
  the hero's `<source>` offers. The details page calls it at render, which
  puts it in `<head>`. `MediaLink` calls it on mousedown/click, so the image
  downloads alongside the page payload instead of after it. On a cold,
  throttled click (1.6 Mbit, 300ms) the page now lands with its picture
  already sharp.
- The `intro` reveal is a 400ms opacity fade instead of the blur. It only
  hides what was never drawn: server HTML keeps the picture visible (hiding it
  until hydration would hold the LCP image off screen until the scripts ran).
  A `useSyncExternalStore` server snapshot tells a server-rendered mount from
  a client one.
- The tail-id skeleton is now the hero's own layout (same column, gutters,
  bottom padding), so the page fills in where it stands.

## Mistakes

- First assumption was that the flash was the tail-id shell, since the user's
  example looked like the kind of URL the Worker serves. `curl` showed it was a
  prerendered edge HIT with the content in the HTML. The blank came from the
  client, not the server.
- The first throttled verification "proved" the press-time preload by landing
  sharp, but the warm-up visit had already cached that image. It only counted
  after clearing the browser cache between the warm-up and the measured click.
- Nearly warmed the hero image on hover and touchstart, like the route. A
  backdrop is 65-200 KB, and a thumb scrolling a rail brushes every poster in
  it. mousedown and click are committed presses; hover is not.

## What worked

- A CDP screencast filmstrip with per-frame timestamps answered "what does the
  user actually see" in one run. Reading the code would have found the
  `loading.tsx`, but not the blur being the finished image held back.
- Reusing the AVIF srcset builder (`avifSrcSet`) rather than a second
  description of the hero's image. The preload names the same candidate by
  construction.

## Rules

- A loading boundary must look like the page it stands in for, or not exist.
  On a static export with intent prefetch, "keep the old page + a delayed
  pending cue" beats any skeleton.
- Never hold a downloaded image behind an effect. Reveal only what has not
  been drawn yet.
- A preload must name exactly what the element will request (same type, same
  srcset, same sizes), or it is a second download.
- Filmstrip before and after. "Flashy" is a sequence of frames, not a line of
  code.
