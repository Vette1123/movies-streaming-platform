# The page was finished, and hidden

## What

The first screen painted a grey skeleton even though the static HTML already held
the whole page. React writes any Suspense boundary over 12.8KB out of line, even
when it finished rendering: the real markup goes into a hidden div near the end of
the document and the fallback paints until an inline script swaps them. Next does
not expose the threshold.

- Removed `loading.tsx` from home, `/movies` and `/tv-shows`, and the hero's
  Suspense. The `<h1>` moved from a hidden div to byte 31,898 of the shell.
- Nav links got `LinkPendingBar`, the same trade the detail routes made earlier.
- Posters no longer ship under `filter: blur` until hydration.
- The hero pulse is a composited ring, not an animated box-shadow.
- A hydrated image is never veiled, so the blur stand-in survives hydration.
- A one-line capture listener in `<head>` rescues wsrv failures before React runs.
- Detail pages get the blur stand-in, six requests at a time, 4s limit, fail-soft.
- Neighbour art is not warmed on data saver or 2g.

## Mistakes

- Reported a 2s LCP render delay as the bottleneck. It was Lighthouse's simulated
  throttling in a headless browser with no GPU. Devtools throttling showed 24ms of
  render and 3.7s of download. Never quote simulate subparts as ground truth.
- Added a blur placeholder to the home hero and never looked at the frame it was
  for. It was behind the loading skeleton, and the intro branch would have hidden
  it at hydration anyway. The filmstrip thumbnails had been sitting unread on disk.
- Checked "the h1 is in the HTML" for months with `pnpm seo:verify`. It was, in a
  hidden div. A text match cannot tell present from visible.
- Patched `notFound()` with a first-match replace and hit `generateMetadata`. The
  typecheck caught it.
- Assumed the 110KB chunk was app code. It is `noModule` polyfills that no modern
  browser downloads.
- Fixed two blur branches and missed the third. The source-level test found it.

## What worked

- Looking at the filmstrip, then at byte offsets in the production HTML.
- Reusing the detail routes' trade (no loading.tsx, pending bar) rather than
  designing a new one.
- Keeping rails in their Suspense boundaries: below the hero, they still give
  React separate hydration tasks.

## Rules

- A static route's above-the-fold content never sits inside Suspense or a
  loading.tsx. `tests/first-paint-shell.test.ts` and `pnpm seo:verify` pin it.
- Read the filmstrip before reading the LCP subparts.
- Nothing in server HTML may depend on hydration to look right: no filter, no
  opacity 0, no veil on the pass after hydration.
