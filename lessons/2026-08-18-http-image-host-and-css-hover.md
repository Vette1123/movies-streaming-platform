# Mixed-content image host, and a hover that waited for hydration

Date: 2026-08-18

## What

Two complaints, one report: the card hover "was removed on desktop", and images
"used to load instantly, now they take time".

Measured on production (`www.reely.space`), not reasoned about:

- Every ImageKit URL in the served HTML was `http://` — **1071 of them, zero
  `https://`**. On an HTTPS document that is passive mixed content: Chrome
  reported 213 resource-timing entries with `transferSize: 0`,
  `nextHopProtocol: ""`, i.e. nothing was fetched. Every poster then walked
  `BlurredImage`'s error chain and painted from **wsrv.nl** instead
  (`img.currentSrc` proved it). So each image cost a dead request plus a
  round-trip to a second host, and lost AVIF: 10,536 B (ImageKit AVIF w384)
  → 16,882 B (wsrv WebP w384), +60%.
- The hover itself was intact — DOM, CSS and framer spring all worked when
  probed (`img` scale 1.05, scrim opacity 1, `matrix(1.05, 0, 0, 1.05, 0, -10)`).
  But **all** of it was gated on `useHasHoverPointer()`, whose server snapshot is
  `false`, so nothing hover-related existed until React hydrated — and hydration
  was late precisely because of the image storm above.

Fixes: force `https://` on `IMAGE_CACHE_HOST_URL` in `lib/constants.ts`, and stop
gating the CSS half of the hover (scrim, play badge, rating strip, poster zoom,
ring, shadow) on a post-hydration state. The framer spring and the Radix
HoverCard stay behind the mount gate — they are what the mobile measurement in
9e89605 was about.

## Mistakes

- **Assumed the reported symptom was the bug.** "Hover was removed" read as a
  regression in `card.tsx`; the first twenty minutes went into the hover gate,
  the Tailwind named-group CSS and the framer branch. All three were fine. The
  hover complaint was a _symptom of the image bug_ — a page that hydrates late
  has no hover, and the user hovers before it lands.
- **Trusted a JS scan of `document.styleSheets` over the CSS file.** Searching
  `selectorText.includes('group/card')` returned zero matches and briefly looked
  like "Tailwind never emitted the variants". The selector text carries the
  escape (`.group\/card`), and the rule walk under-counted anyway (121 leaves for
  a 149 KB sheet). `curl` the stylesheet and grep it — the file is the truth.
- **Nearly blamed AVIF.** The theory was that ImageKit's AVIF encode is slow on
  a cold transform. Timed it: 0.20–0.45 s cold vs 0.23–0.29 s for WebP, at half
  the bytes. Not the cause. The 3-entries-per-URL pattern was the real clue and
  it was sitting in the same measurement.
- **Wrote the `constants.ts` patch through a shell heredoc.** Bash ate the
  `//` in `http://` and the regex escapes, and committed a broken
  `/^http:\/\//` → `/^http:///`. Use the `Edit` tool for anything containing
  slashes, backticks or `$`.

## What worked

- `performance.getEntriesByType('resource')` + `img.currentSrc` as the diagnosis
  pair. `transferSize: 0` with `nextHopProtocol: ""` is the signature of a
  blocked request; `currentSrc` names the host that actually painted. Neither is
  visible in a screenshot, and the site _looked_ fine.
- Comparing prod against localhost. Local had 38 unique image URLs and 38
  requests — exactly one each. Prod had 70 unique and 214. That ratio localised
  the bug to the deploy environment before any code was read.
- `Emulation.setScriptExecutionDisabled` to prove the new hover is CSS-only:
  with JS off, hovering a poster still gives scale 1.05 and scrim opacity 1.
- Walking the built CSS's at-rule stack to confirm `group-hover/card:` rules sit
  inside `@media (hover:hover)` — that is what makes rendering the overlays
  unconditionally safe on touch.

## Rules

- **A `NEXT_PUBLIC_*` URL secret is a scheme waiting to be wrong.** Normalise it
  in code (`lib/constants.ts`), never trust six deploy environments to carry
  `https://`. Mixed content fails _silently and successfully_ here, because the
  fallback chain hides it.
- **Hover that only exists after hydration is hover that does not exist.** CSS
  hover costs a touch device nothing when the variant is inside
  `@media (hover:hover)`; only mount-gate the things that actually allocate
  (framer, Radix).
- `pointer-events: none` also switches off `:hover` matching. It is not a
  visibility flag.
- Read `styleSheets` from the network, not from `document` — escapes and nested
  at-rules make the DOM API the wrong lens.
- When two complaints arrive together, look for the one cause first. Late
  hydration presents as "the interaction is gone".

Related: [Cover-aware image `sizes`](2026-08-14-cover-aware-image-sizes.md),
[Image CDN fallback quality](2026-08-13-image-cdn-fallback-quality.md).
