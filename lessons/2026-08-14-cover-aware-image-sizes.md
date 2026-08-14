# `sizes` must describe what `object-cover` paints — 2026-08-14

## What

The report: "details page image quality is so bad, although I have ImageKit."
Measured in a browser: on a 2560px window the details hero was a **1080px file
stretched across 2552 CSS px** (0.42 of the pixels it paints). Not the CDN, not
the quality setting, not the fallback chain — `sizes` said
`(min-width: 1024px) 1024px, 100vw` for an image that is as wide as the display.

Then, on "cover all images in all website", the same class of bug was audited
across every route at two viewports, and every image on the site now serves what
it paints.

| image                     | before        | after                   |
| ------------------------- | ------------- | ----------------------- |
| details hero (desktop)    | 0.42          | 1.00                    |
| details hero (phone dpr3) | 0.27          | 0.43 (deliberate brake) |
| homepage hero (phone)     | 0.27          | 0.43                    |
| hero wordmark (dpr2)      | 0.50          | 1.00                    |
| hero side poster (dpr2)   | 0.54          | 1.16                    |
| collection banner (phone) | 0.50          | 0.80                    |
| details poster            | w500 ceiling  | `/original`, q70, 1.03  |
| cast portraits (desktop)  | 1.95 (wasted) | 1.00 / 1.49             |

Ratio = served px ÷ px actually painted (`box × DPR`, cover-aware).

Changes: `lib/image-sizes.ts` (shared cover-aware `sizes`, with the measured
reasoning), cover-correct `sizes` in both heroes, the collection banner and the
franchise strip, `/original` sources where a `w500` file was the ceiling, a hand
written 1x/2x `srcSet` for the wordmark (a plain `<img>` gets no srcset from
next/image), lazy wordmarks on off-stage carousel slides, `POSTER_QUALITY` named
at the two poster call sites that render through the hero's `intro` branch, and
one shared `DetailsPoster` for the movie/series pages that had identical copies.

Heroes also stopped passing `priority`. `priority` emits a `<link rel=preload
imagesrcset>` naming the **WebP** srcset, which is why `AvifSource` refuses to
run for those images — so the LCP image was the one image on the page that could
not have AVIF. `loading="eager"` + `fetchPriority="high"` is the same fetch
without the preload tag. Measured on the details page, 1.6 Mbit / 4x CPU, cold,
dpr 2, 4 runs each:

```
priority + WebP   110 KB   starts ~320ms   done ~4.8s
eager    + AVIF    65 KB   starts ~450ms   done ~3.3s
```

## Mistakes

**Fixed the page in the report and stopped.** The first pass fixed the details
hero, ran the audit on it, and was ready to commit. The identical lie was in
four other places — the homepage hero (`100vw` for a cover box), the collection
banner, the hero's side poster, the wordmark — and it took the user saying
"cover all images in all website" to go look. `grep -rn "sizes="` is ten seconds
and would have found all of them at minute one. The lesson from 2026-08-13 says
this in as many words ("when a class of bug is found in one branch, grep the
other branches"), and it still wasn't done first.

**Read `naturalWidth` as the decoded width.** It is not: for an image chosen
from a `srcset` with `w` descriptors the browser divides the intrinsic size by
the candidate's density, so a 2560px file selected against a 3840w descriptor
reports `naturalWidth === 1706`. Ten minutes went into "ImageKit is returning
1706 for a w-2560 request", including re-probing the endpoint four ways with
different `Accept` headers, before re-fetching the same URL and decoding the
blob showed a real 2560x1440. The audit now derives the served width from the
URL and the source cap, never from `naturalWidth`.

**Built an audit harness that measured its own artifact.** It navigated, then
applied the device-metrics override, then measured — so any image that had
already picked a candidate (everything above the fold) was reported against the
NEW viewport with the OLD selection. That is how "collection page cards are at
0.49" appeared, a defect that did not exist. Chrome does not re-run srcset
selection downward on a resize. The harness now reloads _under_ the emulated
metrics; the phantom finding vanished.

**The AVIF `<source>` silently ignored a caller's `quality`.** `BlurredImage`
spreads props after its default so the `<img>` honours `quality={70}` — but
`AvifSource` was handed the branch constant directly. Every modern browser takes
the AVIF copy, so a call site asking for 70 got 65 and the override looked like
it worked (the WebP fallback did have it). Only caught because an audit row
printed `q65` on a poster that had just been given `quality={POSTER_QUALITY}`.
A default and an override in two places is one place too many.

**Yesterday's wordmark conclusion was half right, and the half it missed is
DPR.** The 2026-08-13 lesson argued the logo must stay at `w500` because it lays
out at its intrinsic 500 **CSS** px — correct, and irrelevant to whether the
file has enough pixels: a dpr-2 laptop paints those 500 CSS px across 1000
device px from a 500px file. It was the softest image on the homepage and the
argument for keeping it that way was written down with numbers. "It lays out at
the file's intrinsic width" answers a question about _layout_; sharpness is
answered by `CSS px × DPR`.

**Refactor tripped the React Compiler.** Hoisting a two-line `resolveQuality`
helper to module scope and calling it in JSX made the compiler bail on the whole
component ("Existing memoization could not be preserved" — a lint _error_ here),
which the typecheck happily passed. Moving the resolution inside `AvifSource`
fixed it. `pnpm lint` after a refactor, not just `tsc`.

## What worked

- **One measurement, applied everywhere.** `need = box × DPR`, cover-aware
  (`boxAR >= imageAR ? boxW : boxH × imageAR`), against the width the URL
  actually resolves to. Every finding and every fix in this lesson is that one
  number; the audit script is in the scratchpad and is worth rewriting whenever
  this comes up (~40 lines).
- **Blocking the primary host with CDP** (`Network.setBlockedURLs
["*ik.imagekit.io*"]`) to prove the fix carries through the wsrv stage. Same
  widths, same quality, WebP instead of AVIF exactly as documented.
- **A/B by `git stash`.** Measuring the "before" by stashing the whole change,
  running the same script, and popping — rather than trusting a remembered
  number from a different run.
- **Comparing candidate bytes before choosing a `sizes` brake.** 1200 → 31.7 KB,
  1920 → 76 KB, 2560 → 112 KB made the phone-hero trade a decision with numbers
  attached instead of a preference.

## Rules

- **`sizes` describes the painted image, not the box.** With `object-cover`, the
  moment the box is taller than the image's ratio the height drives the width:
  `100svh × 16/9` is 1500 CSS px on a phone, not 390. Anything full-bleed and
  full-height needs `(max-aspect-ratio: …) …vh` before `100vw`.
- **A plain `<img>` has no srcset unless you write one.** next/image's loader
  never sees it, so it gets neither responsive widths nor a density pair — and
  on retina that is a guaranteed 0.5.
- **Check the source segment before blaming `sizes`.** `/w500` caps the file at
  500 px however large the request: no `sizes` value can fix a 400 CSS px box on
  a dpr-2 screen. Full-bleed or large-box images read from `/original`.
- **`priority` costs you AVIF.** It buys a preload of the WebP srcset; on a slow
  link the smaller format is worth more than the head start, for any image that
  is already in the first screenful of the document.
- **Verify a measurement tool against a known-good case before trusting its
  findings.** Both false leads today came from the instrument, not the code.
