# The unclassified column was hiding our own bug

Date: 2026-09-19
Area: `scripts/cf-health.mjs`, `scripts/posthog-query.mjs`, `lib/tmdbConfig.ts`,
`lib/rail-scroll.ts`, `components/list.tsx`, `components/pwa/install-prompt.tsx`

## What

A health sweep, then everything it turned up.

**Cloudflare.** 0 kills of 22,319 invocations, 0 eyeball 5xx. The one number
not green was CPU p99 at 8.75ms against a nominal 10ms — and `pnpm cf:cpu`
showed why and that it is not code: cold isolates cost 5.44ms against 1.36ms in
the two colos with real volume. Nothing was changed for it.

**The 4xx column.** 1,551 requests sat unclassified, and every one of the top
twelve was a secret scanner writing its dots as `%2e`: `/database%2exml`,
`/token_sqs%2etxt`, `/opt/aws_credentials%2ejson`. That is filter evasion, and
it beat the extension buckets by construction — `/\.(txt|xml)$/` cannot match a
path containing no `.`. Decoding the path before bucketing, plus two wordlist
buckets and an honest row for Android App Links, took the column from 1,551 to
**55**, and what is left is real: genuine 404s on TMDB ids.

**And inside it, our own bug.** `/movies/c-at_max/originalnull`, 22/day. Every
image builder in `lib/tmdbConfig.ts` is typed `(imgPath: string)` and
interpolates straight into a template literal, so a `null` — which is what TMDB
returns for `backdrop_path`, `poster_path` and `logo_path` on a title with no
art — stringified into the URL. `/original` + `null`. Each one then walked
BlurredImage's whole onError chain, so one missing poster cost three 404s across
ImageKit, wsrv and TMDB's origin. Guarded in the builders, with a test.

**PostHog.** No `$exception` in 7 days. But 46 `$dead_click`, 19 `$dead_swipe`
and 8 `$rageclick` in 14. Two were real and are fixed:

- The install nudge. Four dead clicks, not one on a control: two on the card,
  one on the 40px cyan tile, one on the glyph inside it. Every other filled
  gradient on the site is a button. It is a button now.
- The rail arrows. `canRight` compares three numbers that all change without a
  scroll and without the window moving, and it was only recomputed on `scroll`
  and `window.resize` — so a rail whose content grew (images decoding, the
  Suspense swap) or which was still `content-visibility: auto` at 0×0 kept
  whatever state it was born with. A ResizeObserver on the track, and
  `scrollByPage` now re-derives instead of scrolling zero pixels.

Two were false positives and are written down as such rather than "fixed": the
search-input dead clicks are cmdk's already-focused palette input, and the lone
ellipsis rageclick is a popover being toggled.

## Mistakes

**The stretched button was layered backwards and would have fixed nothing.**
The overlay went in first with the content given `relative`, which paints the
content ABOVE it — so a click on the tile hits the tile, bubbles to the card,
and never reaches a button that is its sibling rather than its ancestor. The
comment explaining the (wrong) layering was already written. Hit-testing it with
`elementFromPoint` is what caught it: tile → overlay, glyph → overlay, copy →
overlay, Install → install, Dismiss → dismiss, all five measured.

**A test asserted the wrong thing about srcset and failed on correct code.**
`getLogoImageSrcSet` was guarded on the reasoning that a `data:` URI contains a
comma and srcset is comma-separated. It is not: srcset is parsed by collecting
non-whitespace runs, and an ImageKit transform URL already carries three commas
of its own (`tr:w-500,q-70,f-auto,c-at_max`). The guard is still right for a
different reason — "no image at any density" is an absent attribute — but the
stated reason was invented and `split(',')` reported eight candidates for a
srcset that has always been valid. The test earned its keep by failing.

**The bug in the 4xx column had been visible for weeks and read as noise.**
`/movies/c-at_max/originalnull` was sitting in a list of credential scanners,
and a list that long is not read. Classification is not tidying — it is what
makes the residue legible.

**`c-at_max` was added to the image transform and not to the bucket that
matches it.** The image-crawler regex names `f-auto|f-webp|pr-true|q-\d+`, the
parameters that existed when it was written. `c-at_max` was appended later and
is the LAST parameter, so it is the fragment a comma-splitting crawler is left
holding most often — and those went straight to unclassified looking new.

**The browser harness could not verify the rail at all.** 72 cards in the DOM
and every rail measuring 0×0, because the tab is `visibilityState: hidden` and
`content-visibility: auto` never renders. Rather than declare it verified, the
arithmetic moved to `lib/rail-scroll.ts` and got ten tests — including the 0/0
case, where the old expression's forward sum goes negative and is false by luck
rather than by intent.

## What worked

- `elementFromPoint` on a probe built from the component's own class strings,
  injected into the live page. Same stylesheet, same cascade, real hit-testing,
  and it does not need the component's mount conditions to be satisfiable.
- Decoding before matching rather than adding a `%2e` regex. One line covered
  every existing bucket against the same trick; the twelfth regex would have
  covered one scanner until it changed encoding.
- Running the health script again after each bucket change. 1,551 → 580 → 139 →
  55, and each step named what was still unexplained.
- Writing down the false positives. Half the dead-click list was not a defect,
  and saying which half is the difference between a report and a to-do list.

## Rules

- Classify the benign so the residue is readable. An unclassified column nobody
  reads is the same as no column, and ours was hiding a real bug in plain sight.
- Decode before you match. Any pattern in a security-adjacent filter is evaded
  by percent-encoding the one character it anchors on.
- A transform parameter added in one file has to be added to the log bucket that
  matches it, or its fragments arrive looking like a new failure.
- A `string`-typed field that the API documents as nullable is a runtime `null`
  the compiler will not catch. Guard in the builder, not at the call sites —
  nine of them pass these paths and the type cannot tell the guarded apart.
- A stretched click target sits ABOVE inert content and BELOW the real controls.
  Verify it by hit-testing, never by reading the z-index.
- Any state derived from element sizes needs a ResizeObserver. `scroll` and
  `window.resize` are not the only ways a size changes, and the failure is a
  control that is present, lit, and does nothing.
- When the harness cannot render the thing, move the logic somewhere that can be
  tested and say so. "Verified" has to mean something was measured.
