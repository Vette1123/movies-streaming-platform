# Image CDN & fallback chain

All TMDB poster/backdrop images route through a CDN proxy, with an automatic
multi-stage fallback so a dead/expired CDN never breaks images.

## Current setup

**Primary source:** ImageKit — env `NEXT_PUBLIC_IMAGE_CACHE_HOST_URL`
(e.g. `https://ik.imagekit.io/sblfxr6i3`). ImageKit's origin is set to
`https://image.tmdb.org/t/p`, so the proxy path mirrors TMDB exactly:

```
ImageKit : https://ik.imagekit.io/<id>/w500/abc.jpg
wsrv.nl  : https://wsrv.nl/?url=https://image.tmdb.org/t/p/w500/abc.jpg&w=500&q=70&output=webp&we
TMDB     : https://image.tmdb.org/t/p/w500/abc.jpg
```

**Fallback chain** (each image `onError` advances one stage):

1. **ImageKit** — primary managed CDN
2. **wsrv.nl** — free, keyless, Cloudflare-backed proxy; serves the TMDB origin
   as WebP (still optimized when ImageKit is down)
3. **TMDB origin direct** — free, keyless, unmetered, never expires — final
   safety net

Once at TMDB origin, `getNextImageFallback` returns `null` (chain exhausted).
External hosts (Unsplash, Twitter avatars) are left untouched.

## The fallback is not a quality downgrade (and why it used to be)

At the **same width and quality**, wsrv and ImageKit return byte-identical
WebP — measured on the same backdrop:

| request   | ImageKit | wsrv.nl  |
| --------- | -------- | -------- |
| w1200 q65 | 10 678 B | 10 678 B |
| w1200 q82 | 18 252 B | 18 252 B |

So the chain never had a per-pixel problem. It had a **width** problem, and the
fallback looked bad for two reasons, both fixed:

- **The width was pinned.** `lib/image-loader.ts` only rewrote ImageKit URLs and
  passed everything else through, so a wsrv URL produced a `srcset` whose
  candidates were all the same file under different `w` descriptors. Every
  device got the single width baked into the fallback URL — 2560 for anything
  off `/original`. A phone that fell off ImageKit downloaded a **118 KB** hero
  where the width it paints costs **4 KB**. The loader now rewrites wsrv's `w`
  and `q` too, so the fallback is fully responsive at the same 65/70 quality.
- **wsrv was upscaling.** TMDB's `original` is not a width: plenty of backdrops
  are natively 1280 or 780 px, and wsrv will enlarge one to whatever it is
  asked for. Measured on a w780 source asked for w=2560: **45.8 KB of blur**,
  against **10.1 KB** for the same request with `&we` ("without enlargement").
  That upscale was the visible "fallback looks terrible". `buildWsrvURL` now
  always sends `&we`.

wsrv has **no AVIF saver** (`Supported savers: jpg, png, webp, tiff, gif, jxl`),
so once off ImageKit the site is WebP-only. That is the one real regression and
it costs bytes, not pixels — `avifSrcSet` correctly returns `undefined` for any
non-ImageKit URL, so nothing offers an AVIF `<source>` that would 400.

## Circuit breaker

ImageKit running out of quota is not one broken image, it is every image on
every page. `lib/tmdbConfig.ts` keeps a module-level flag: **three distinct**
primary-host failures trip it, and every `BlurredImage` that has not painted yet
(subscribed via `useSyncExternalStore`) re-renders straight onto wsrv. Without it
each `<img>` pays a doomed request first, and the hero's
`<link rel=preload imagesrcset>` names a URL that will 4xx.

**Two guards, both paid for in blood.** The first cut tripped on ONE error and
demoted every mounted image. Measured in a browser: dispatching a single `error`
on one poster moved **17 of 20** homepage images to wsrv — all already painted
from ImageKit and warm in the HTTP cache. They re-downloaded from a cold host and
replayed their blur-ups, which reads exactly as _"the images went blank on
refresh and nothing is cached"_. So:

1. **Three distinct URLs, not one.** `error` fires for a poster TMDB no longer
   has, a request aborted by navigating away, a content blocker, a flaky
   connection. A host that is really down fails every image and reaches three
   within the first screenful; none of the others do. The same URL retrying is
   one piece of evidence, and a failure on a later stage is evidence about that
   stage.
2. **Never demote an image that already painted.** The breaker exists to stop
   images that have _not loaded yet_ from queueing behind a dead host. Anything
   with pixels on screen keeps its working, cached URL.

Measured after the fix: 1 error moves 1 image; 4 distinct errors trip the breaker
and still move only the 4 that failed; a refresh is 17/17 from cache, 0 KB.

It is deliberately **not persisted** — a fresh tab probes ImageKit once more,
which is also how the site notices the quota reset without a deploy.

`<ImageHostTracker>` (providers/posthog-provider.tsx) subscribes once and fires
the `image_host_fallback` PostHog event when it trips. The chain is silent by
design, so without that the way we'd learn the quota is spent is a user saying
the site looks wrong.

## `c-at_max` on the primary

`originalImage` asks for `w-2560`, and TMDB `original` files are frequently
narrower than that. ImageKit upscales on request just like wsrv: a 780 px source
asked for `w-2560` came back **30 060 B** against **6 054 B** at its native
width — the browser paints it at the same size either way. `c-at_max` fits
inside the requested box without enlarging, and a source that _is_ bigger is
untouched (a 3840 px original returns an identical 55 044 B / 2560×1440 with and
without it).

The `w500`/`w300`/`w185` builders deliberately **don't** carry it: their path
names an exact width and the loader already clamps to it, so upscaling is
impossible — and adding it there measured 3% _larger_ and shaved a pixel
(500→499).

## Homepage image audit (2026-08-13, headless Chrome)

Cold vs warm, cache cleared between:

| viewport | requests | cold   | warm              |
| -------- | -------- | ------ | ----------------- |
| 764 @1x  | 17       | 247 KB | 17/17 cache, 0 KB |
| 390 @3x  | 19       | 573 KB | 19/19 cache, 0 KB |
| 1512 @2x | 23       | 941 KB | —                 |

All over HTTP/3, no duplicate URLs, **no image fetched that is never displayed**,
0 blank, 0 stuck blurred. Caching needs nothing: ImageKit sends
`Cache-Control: public, max-age=31536000, must-revalidate`, and the service
worker never touches cross-origin, so nothing can interfere.

Two payload gaps the audit found, both fixed:

- **The hero wordmark was the two heaviest files on the page** (31 KB + 29 KB of
  a 247 KB load). It is the only image rendered as a plain `<img>`, so
  next/image's loader never saw it and it kept the URL's default `q-82` while
  every other image was tuned to 65/70. Now `apiConfig.logoImage` at `q-70`.
  Width was left at 500 on the reasoning that the element lays out at the file's
  intrinsic width, so a narrower file would shrink the wordmark rather than
  sharpen it — true of CSS px, and it forgot DPR. 2026-08-14 added a hand-written
  1x/2x `srcSet` (`getLogoImageSrcSet`); retina now gets 1000 px, and only
  retina pays for it.
- **The hero's cinematic side poster was fetched on phones and tablets**, where
  its wrapper is `hidden lg:flex` and it can never paint. It inherited
  `priority` from the first slide, so it was eager AND got a
  `<link rel=preload imagesrcset>`. Now `loading="lazy"` (a display:none image
  never intersects, so it is not requested below lg) and `sizes="400px"` instead
  of a claim of 1024px for a 400px box. Measured after: 0 fetches at 390 and
  768, 2 at 1512 where it is actually on screen, and one image preload instead
  of two.

## Whole-site sharpness audit (2026-08-14)

The 2026-08-13 audit measured **bytes**. This one measured **pixels**, and found
the site's real image defect: several `sizes` strings described the element's
box while the image was laid out with `object-cover`, which paints the image
_wider_ than its box as soon as the box is taller than the image's ratio.

For a 16:9 backdrop in a full-bleed `100svh` hero:

```
painted width = max(100vw, 100svh × 16/9)     // 1500 CSS px on a 390×844 phone
served px     = candidate width               // capped by the source segment
ratio         = served ÷ (painted × DPR)      // 1.0 = exactly enough
```

Measured before → after (ratio; higher is sharper, 1.0 is the target):

| image                     | before | after | why                               |
| ------------------------- | ------ | ----- | --------------------------------- |
| details hero, 2560 window | 0.42   | 1.00  | `sizes` claimed a 1024px box      |
| details / home hero, dpr3 | 0.27   | 0.43  | cover geometry + deliberate brake |
| hero wordmark, dpr2       | 0.50   | 1.00  | plain `<img>` had no 2x srcset    |
| hero side poster, dpr2    | 0.54   | 1.16  | `w500` source was the ceiling     |
| collection banner, phone  | 0.50   | 0.80  | fixed-height cover band           |
| details poster            | 0.63   | 1.03  | `w500` ceiling + `q-65` default   |
| cast portraits, desktop   | 1.95   | 1.49  | over-served, `15vw` → `10vw`      |

Rules that came out of it live in `lib/image-sizes.ts`. The remaining sub-1.0
rows are deliberate ceilings, both documented where they are set: `/original`
requests are capped at 2560 px (`lib/image-loader.ts`), and phones ask for
160vw rather than the full cover width (1920 instead of 2560: 76 KB vs 112 KB,
on the image that is ~70% cropped away on a phone).

**Heroes no longer pass `priority`.** It emits `<link rel=preload imagesrcset>`
naming the WebP srcset, which is exactly why `BlurredImage` refuses to offer an
AVIF `<source>` alongside it — so the LCP image was the one image on the page
that could never be AVIF. `loading="eager"` + `fetchPriority="high"` is the same
fetch minus the preload tag. Measured on the details page (1.6 Mbit, 4x CPU,
cold, dpr 2, 4 runs each): **110 KB WebP starting ~320ms and done ~4.8s** versus
**65 KB AVIF starting ~450ms and done ~3.3s**.

Verified on both stages of the chain: with `*ik.imagekit.io*` blocked in CDP,
wsrv served the same widths at the same quality (WebP, as documented above).

## Where it lives

- `lib/image-sizes.ts` — cover-aware `sizes` for the heroes, with the numbers
- `lib/tmdbConfig.ts`
  - `apiConfig.{originalImage,w500Image,w185Image,w300Image}` — build the
    **primary** URL from `IMAGE_CACHE_HOST_URL`.
  - `getNextImageFallback(src)` — given a failed URL, return the next stage
    (recovers the TMDB path from any stage, rebuilds the next URL).
  - `buildWsrvURL(path, width?, quality?)` — the single wsrv URL builder, shared
    by the chain and the loader.
  - `demoteFromPrimary` / `markPrimaryImageHostDown` / `subscribePrimaryImageHost`
    — the circuit breaker above.
  - `handleImageFallbackError(el)` — the shared `onError` for plain `<img>`s.
- `lib/image-loader.ts` — rewrites width/quality for **both** ImageKit and wsrv
  URLs, so both stages get a real `srcset`.
- `components/blurred-image.tsx` — `onError` walks the chain for all
  posters/backdrops (the shared image renderer).
- `components/command-menu.tsx` — `handleImageFallbackError` on the
  search-dropdown thumbs.
- `next.config.mjs` — `images.remotePatterns` allows `image.tmdb.org` and
  `wsrv.nl` (only enforced if `images.unoptimized` is ever turned off).

## How to change the PRIMARY source later

The fallback chain already covers outages. Only change the primary if you want
to **drop ImageKit entirely** (e.g. it expires and you don't renew).

### Option A — make wsrv.nl the primary (free, still optimized)

Edit `lib/tmdbConfig.ts` `apiConfig` image builders to emit wsrv URLs:

```ts
const WSRV = 'https://wsrv.nl/?url=https://image.tmdb.org/t/p'
const apiConfig = {
  // ...
  originalImage: (p: string) => `${WSRV}/original${p}&output=webp`,
  w500Image: (p: string) => `${WSRV}/w500${p}&output=webp`,
  w185Image: (p: string) => `${WSRV}/w185${p}&output=webp`,
  w300Image: (p: string) => `${WSRV}/w300${p}&output=webp`,
}
```

Then in `getNextImageFallback`, stage 0 becomes wsrv, so drop straight to TMDB
origin (or leave as-is — an already-wsrv URL is stage 1, which already falls to
origin). No other change needed. `IMAGE_CACHE_HOST_URL` can be removed.

**Trade-off:** wsrv is a free public service — no SLA. TMDB-origin fallback
still covers wsrv outages.

### Option B — make TMDB origin the primary (simplest, zero deps)

No proxy, no optimization, but free/unlimited/never-expires. Two ways:

- **Cheapest:** set env `NEXT_PUBLIC_IMAGE_CACHE_HOST_URL=https://image.tmdb.org/t/p`
  — the existing builders (`${HOST}/w500${p}`) then produce origin URLs
  directly. No code change.
- Or hard-code the builders to `https://image.tmdb.org/t/p` and delete the env.

**Trade-off:** posters ship as JPEG (~2x the WebP size). Fine for the small
poster sizes; heavier for `original` backdrops.

### Option C — swap to a different managed CDN (Cloudinary, Bunny, new ImageKit key)

Point that CDN's origin/fetch at `https://image.tmdb.org/t/p`, then set
`NEXT_PUBLIC_IMAGE_CACHE_HOST_URL` to the new base. As long as the path stays
`/{size}/{file}`, `getNextImageFallback` keeps working unchanged. If the new
host uses a different path shape, update `extractTMDBPath` / `imageStage` in
`lib/tmdbConfig.ts`.

## Alternatives comparison

| Option      | Free tier              | Optimize  | Key? | Notes                                                          |
| ----------- | ---------------------- | --------- | ---- | -------------------------------------------------------------- |
| TMDB origin | unlimited              | no        | no   | never expires; JPEG only                                       |
| wsrv.nl     | free (donation-funded) | WebP only | no   | public, no SLA; measured: no AVIF saver                        |
| ImageKit    | 20 GB/mo (perpetual)   | yes       | yes  | current primary; "2-week" was trial credits, not the free plan |
| Cloudinary  | ~25 GB/mo              | yes       | yes  | mature managed                                                 |
| Bunny.net   | paid (~$1 min)         | yes       | yes  | cheap, reliable                                                |

## Verifying a change

```bash
pnpm images:check        # asserts every URL shape in the chain + the loader
pnpm images:check:live   # same, then fetches each one and prints status/bytes
pnpm exec tsc --noEmit
```

`scripts/check-image-fallback.mjs` bundles the real TS modules with esbuild
rather than re-implementing them, so it cannot drift from the code it checks.

Then load `/movies`, block the primary host in DevTools (Network → block
request domain), reload, and confirm posters still render from the next stage.
