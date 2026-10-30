# Image CDN & fallback chain

All TMDB poster/backdrop images route through a CDN proxy, with an automatic
multi-stage fallback so a dead/expired CDN never breaks images.

## Current setup

**Primary source:** wsrv.nl, built in `lib/tmdbConfig.ts`. There is no account,
key or env var. ImageKit was primary until 2026-10-30, when its free bandwidth ran
out and it answered every image with `429`. A prerendered page cannot run
`onError` until it hydrates, so a metered primary fails the whole first screen.
It was removed entirely. Older numbers below were measured on it.

```
wsrv.nl  : https://wsrv.nl/?url=https://image.tmdb.org/t/p/w500/abc.jpg&w=500&q=70&output=webp&we
TMDB     : https://image.tmdb.org/t/p/w500/abc.jpg
```

**Fallback chain** (each image `onError` advances one stage):

1. **wsrv.nl** — free, keyless, Cloudflare-backed proxy serving WebP
2. **TMDB origin direct** — free, keyless, unmetered, never expires — final
   safety net

Once at TMDB origin, `getNextImageFallback` returns `null` (chain exhausted).
External hosts (Unsplash, Twitter avatars) are left untouched.

## What wsrv is used for, and what was tried

Measured 2026-10-30 at w1200 on a dense and a typical backdrop:

| option        | dense  | typical | decision                                      |
| ------------- | ------ | ------- | --------------------------------------------- |
| WebP q65      | 267 KB | 10.7 KB | what the site serves                          |
| WebP q55      | 229 KB | 9.5 KB  | not worth the softness                        |
| `&sharp=1`    | 434 KB | 16.7 KB | +55%, rejected                                |
| `output=jxl`  | 190 KB | 13.2 KB | larger on typical art, few browsers, rejected |
| `output=avif` | 400    | 400     | wsrv has no AVIF saver                        |

`&default=1` is always sent: a failed fetch redirects to the TMDB origin with no
JavaScript, so it also works on the prerendered first screen. The homepage hero
carries a ~300-byte blurred placeholder (`&w=24&encoding=base64`) fetched at build.

`&we` ("without enlargement") is always sent: TMDB's `original` is not a width,
and without it a w780 source asked for w=2560 came back 45.8 KB of blur against
10.1 KB. The loader rewrites `w` and `q` per candidate, so every image has a real
`srcset`. Bare URLs (`originalImage`, `w500Image`) carry no `output`, so unfurlers
and sitemaps get the source format.

**Share cards** (`lib/og/mosaic.ts`): the Worker's `/api/og/card` returns an SVG
and wsrv rasterises it, cached by the card's URL. wsrv draws text (Arabic
included) and embedded data URIs, but not a remote `<image href>`.

## Before hydration

`&default=1` covers a source wsrv cannot fetch. `lib/image-rescue.ts` covers wsrv itself failing: a capture-phase `error` listener in `<head>` moves the image to the TMDB origin before React is running, and stands aside once React owns the element. A host that hangs fires no `error`, so an eager image still waiting after 8s triggers one 1px request with a 4s limit, which tells a slow link from a dead host; everything still waiting then moves.

## Circuit breaker

wsrv has no SLA. `lib/tmdbConfig.ts` keeps a module-level flag: **three distinct**
primary-host failures trip it, and every `BlurredImage` that has not painted yet
re-renders straight onto the TMDB origin. Two guards: three distinct URLs, because
`error` also fires for missing posters, aborted requests and content blockers;
and never demote an image that already painted, which was measured moving 17 of
20 cached images to a cold host. Not persisted, so a fresh tab probes wsrv again.

`<ImageHostTracker>` (providers/posthog-provider.tsx) fires the
`image_host_fallback` PostHog event when it trips.

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

Rules that came out of it live in `lib/image-sizes.ts`. What is left is two
deliberate ceilings, each documented where it is set.

**`/original` requests cap at 3072 px** (`ORIGINAL_MAX_WIDTH`,
`lib/image-loader.ts`, mirrored by `widthFromPath` for the wsrv stage). Bytes
per width for a hero backdrop, AVIF q65 — the format the heroes actually serve
now:

| width | AVIF   | WebP   |
| ----- | ------ | ------ |
| 1920  | 45 KB  | 74 KB  |
| 2560  | 64 KB  | 109 KB |
| 3072  | 82 KB  | 145 KB |
| 3840  | 126 KB | 233 KB |

A 1512px retina laptop paints its hero at 3378 device px: 2560 was 0.76 of that,
3072 is **0.91 for +18 KB**, and 3840 would buy the last 9% for +62 KB. Note the
trade is width-vs-quality, not width-vs-nothing — at the same 82 KB you can have
q65 at 3072 (0.91 sampling) or q75 at 2560 (0.76), and on an undersampled image
pixels beat compression quality.

**Phones ask 160vw, not the full cover width.** The honest ask lands a dpr-3
phone on the top rung; 160vw lands it on 1920 (45 KB vs 64 KB) at 0.43 instead
of 0.57, on an image that is ~70% cropped off-screen there and sits under a
scrim. Lifting it is a one-word change in `lib/image-sizes.ts` if the phone hero
ever reads soft in the hand.

**Heroes pass no `priority`.** `preloadHeroImage` emits the preload instead, naming
the same srcset the `<img>` carries (`wsrvSrcSet`).

## Where it lives

- `lib/image-sizes.ts` — cover-aware `sizes` for the heroes, with the numbers
- `lib/tmdbConfig.ts`
  - `apiConfig.{originalImage,w500Image,logoImage,w185Image,w300Image}` — build
    the primary URL.
  - `getNextImageFallback(src)` — given a failed URL, return the next stage.
  - `buildWsrvURL(path, width?, quality?, output?)` — the single wsrv URL builder.
  - `demoteFromPrimary` / `markPrimaryImageHostDown` / `subscribePrimaryImageHost`
    — the circuit breaker above.
  - `handleImageFallbackError(el)` — the shared `onError` for plain `<img>`s.
- `lib/image-loader.ts` — rewrites width/quality so every image gets a `srcset`.
- `components/blurred-image.tsx` — `onError` walks the chain for all
  posters/backdrops (the shared image renderer).
- `components/command-menu.tsx` — `handleImageFallbackError` on the
  search-dropdown thumbs.
- `next.config.mjs` — `images.remotePatterns` allows `image.tmdb.org` and
  `wsrv.nl` (only enforced if `images.unoptimized` is ever turned off).

## Rules for changing the primary

The primary must have no monthly cap: a prerendered page cannot recover from a
failing host until it hydrates. Keep the chain's TMDB origin stage, and keep the
`/{size}/{file}` path recoverable in `extractTMDBPath`.

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
